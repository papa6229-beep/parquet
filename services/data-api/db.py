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
        # Set bearer token for private Vercel Blob URLs
        blob_token = os.environ.get("BLOB_READ_WRITE_TOKEN", "")
        if blob_token:
            self.conn.execute(f"""
                CREATE SECRET blob_auth (
                    TYPE HTTP,
                    EXTRA_HTTP_HEADERS MAP {{
                        'Authorization': 'Bearer {blob_token}'
                    }}
                )
            """)
        self._initialized = False
        self._lock = threading.Lock()

    @classmethod
    def get(cls) -> "QueryEngine":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self, urls=None):
        """Load parquet URLs and create sales_view TABLE (materialized).
        Two-phase: validate individually, then bulk load with union_by_name.
        Never raises — always returns partial results."""
        if urls is None:
            urls = load_blob_urls()
        if not urls:
            self._initialized = False
            return [], []

        # Phase 1: Validate each file individually
        valid_urls = []
        bad_urls = []
        for url in urls:
            try:
                self.conn.execute(f"SELECT * FROM read_parquet('{url}') LIMIT 1").fetchone()
                valid_urls.append(url)
            except Exception as e:
                print(f"[init] Bad file: {url.split('/')[-1]} — {e}")
                bad_urls.append(url)

        if not valid_urls:
            self._initialized = False
            return valid_urls, bad_urls

        # Phase 2: Bulk load all valid files with union_by_name (handles schema differences)
        with self._lock:
            self.conn.execute("DROP TABLE IF EXISTS sales_view")
            url_list = "[" + ", ".join(f"'{u}'" for u in valid_urls) + "]"
            try:
                self.conn.execute(f"""
                    CREATE TABLE sales_view AS
                    SELECT * FROM read_parquet({url_list},
                        hive_partitioning=false,
                        union_by_name=true)
                """)
                self._initialized = True
                row_count = self.conn.execute("SELECT COUNT(*) FROM sales_view").fetchone()[0]
                print(f"[init] Done: {len(valid_urls)} files, {row_count} rows loaded")
            except Exception as e:
                print(f"[init] Bulk load failed: {e}, trying binary search...")
                # Binary search: split into halves to find bad files
                self._initialized = False
                self._bulk_load_with_retry(valid_urls, bad_urls)

        return valid_urls, bad_urls

    def _bulk_load_with_retry(self, valid_urls, bad_urls):
        """Try loading files in smaller batches to isolate problematic ones."""
        working = []
        for url in valid_urls[:]:
            test = working + [url]
            url_list = "[" + ", ".join(f"'{u}'" for u in test) + "]"
            try:
                self.conn.execute("DROP TABLE IF EXISTS sales_view")
                self.conn.execute(f"""
                    CREATE TABLE sales_view AS
                    SELECT * FROM read_parquet({url_list},
                        hive_partitioning=false,
                        union_by_name=true)
                """)
                working.append(url)
            except Exception as e:
                print(f"[init] Excluding on retry: {url.split('/')[-1]} — {e}")
                valid_urls.remove(url)
                bad_urls.append(url)

        if working:
            self._initialized = True
            row_count = self.conn.execute("SELECT COUNT(*) FROM sales_view").fetchone()[0]
            print(f"[init] Retry done: {len(working)} files, {row_count} rows")

    def reload(self, urls=None):
        """Re-initialize view after new files uploaded. Returns (valid_urls, bad_urls)."""
        self._initialized = False
        return self.initialize(urls=urls)

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
