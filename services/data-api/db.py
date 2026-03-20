import duckdb
import time
import threading
import os
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from manifest import load_blob_urls
from security import validate_sql, SQLSecurityError

MAX_ROWS = 500
QUERY_TIMEOUT_SECONDS = 30


@dataclass
class QueryResult:
    rows: List[Dict[str, Any]]
    row_count: int
    execution_time_ms: float


class QueryEngine:
    _instance: Optional["QueryEngine"] = None

    def __init__(self):
        os.environ.setdefault("HOME", "/tmp")
        self.conn = duckdb.connect(database=":memory:", read_only=False)
        self.conn.execute("SET home_directory='/tmp'")
        self.conn.execute("SET temp_directory='/tmp'")
        self.conn.execute("SET memory_limit='400MB'")
        try:
            self.conn.execute("LOAD httpfs")
        except Exception:
            self.conn.execute("INSTALL httpfs; LOAD httpfs")
        self._initialized = False
        self._lock = threading.Lock()

    @classmethod
    def get(cls) -> "QueryEngine":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self, urls=None):
        """Load parquet URLs and create sales_view."""
        if urls is None:
            urls = load_blob_urls()
        if not urls:
            # No files yet — don't create view, mark uninitialized
            self._initialized = False
            return
        url_list = "[" + ", ".join(f"'{u}'" for u in urls) + "]"
        with self._lock:
            self.conn.execute(f"""
                CREATE OR REPLACE VIEW sales_view AS
                SELECT * FROM read_parquet({url_list},
                    hive_partitioning=false,
                    union_by_name=true)
            """)
            self._initialized = True

    def reload(self, urls=None):
        """Re-initialize view after new files uploaded."""
        self._initialized = False
        self.initialize(urls=urls)

    def _ensure_initialized(self):
        if not self._initialized:
            self.initialize()
            if not self._initialized:
                raise RuntimeError("데이터 파일이 없습니다. 먼저 어드민 페이지에서 파일을 업로드해 주세요.")

    def get_schema(self) -> Dict:
        self._ensure_initialized()
        columns_result = self.conn.execute("DESCRIBE sales_view").fetchall()
        total_rows = self.conn.execute("SELECT COUNT(*) FROM sales_view").fetchone()[0]
        columns = [
            {"name": col[0], "type": col[1]}
            for col in columns_result
        ]
        sample = self.conn.execute("SELECT * FROM sales_view LIMIT 3").df().to_dict("records")
        return {
            "columns": columns,
            "total_rows": total_rows,
            "sample": sample,
        }

    def query(self, sql: str) -> QueryResult:
        validate_sql(sql)  # raises SQLSecurityError if invalid

        if not self._initialized:
            self._ensure_initialized()

        start = time.time()
        result_holder: Dict = {}
        error_holder: Dict = {}

        def run():
            try:
                rel = self.conn.execute(sql)
                columns = [desc[0] for desc in rel.description]
                all_rows = rel.fetchall()
                result_holder["rows"] = [dict(zip(columns, row)) for row in all_rows[:MAX_ROWS]]
            except Exception as e:
                error_holder["error"] = str(e)

        t = threading.Thread(target=run, daemon=True)
        t.start()
        t.join(timeout=QUERY_TIMEOUT_SECONDS)

        if t.is_alive():
            raise RuntimeError(f"쿼리 타임아웃: {QUERY_TIMEOUT_SECONDS}초를 초과했습니다. 기간을 좁혀 다시 시도해 주세요.")
        if "error" in error_holder:
            raise RuntimeError(f"쿼리 실행 오류: {error_holder['error']}")

        rows = result_holder.get("rows", [])
        elapsed_ms = (time.time() - start) * 1000
        return QueryResult(
            rows=rows,
            row_count=len(rows),
            execution_time_ms=round(elapsed_ms, 1),
        )
