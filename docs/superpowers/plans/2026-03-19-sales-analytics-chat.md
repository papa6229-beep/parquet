# Sales Analytics Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** e-커머스 주문 parquet 데이터(650MB, 20개 파일)를 AI와 채팅으로 분석할 수 있는 내부 웹사이트 구축

**Architecture:** Next.js(Service 1)가 AI SDK로 Claude를 오케스트레이션하고, tool calling으로 Python FastAPI+DuckDB(Service 2)에 쿼리를 위임한다. DuckDB는 httpfs로 Vercel Blob의 parquet 파일을 Range Request로 직접 스캔한다. 두 서비스는 Vercel Services로 단일 프로젝트에 배포된다.

**Tech Stack:** Next.js(App Router), AI SDK v6, Claude(Vercel AI Gateway), Python FastAPI, DuckDB(Python), sqlglot, Vercel Blob, Recharts, shadcn/ui, AI Elements, Geist, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-19-sales-analytics-chat-design.md`

---

## 사전 준비 (구현 시작 전 사용자가 직접 실행)

```
1. Vercel 계정이 없으면 https://vercel.com 에서 가입
2. npm i -g vercel
3. 이 폴더(D:/parquet)에서: vercel link
   → 새 프로젝트 생성 선택
4. Vercel 대시보드 → AI Gateway 탭 → Enable
5. vercel env pull .env.local
```

---

## Phase 1: 프로젝트 구조 초기화

### Task 1: 모노레포 디렉토리 구조 생성

**Files:**
- Create: `apps/web/` (Next.js 앱)
- Create: `services/data-api/` (Python 서비스)
- Create: `vercel.json` (Services 설정)
- Create: `apps/web/package.json`

- [ ] **Step 1: 디렉토리 생성**

```bash
mkdir -p apps/web services/data-api docs/superpowers/plans
```

- [ ] **Step 2: Next.js 앱 생성**

```bash
cd apps/web
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

프롬프트가 나오면:
- Use Turbopack: **Yes**
- Customize default import alias: **No**

- [ ] **Step 3: 루트 vercel.json 생성**

`vercel.json`:
```json
{
  "experimentalServices": {
    "web": {
      "entrypoint": "apps/web",
      "routePrefix": "/"
    },
    "data-api": {
      "entrypoint": "services/data-api/main.py",
      "routePrefix": "/api/data",
      "maxDuration": 60
    }
  }
}
```

- [ ] **Step 4: Next.js 의존성 설치**

```bash
cd apps/web
npm install ai @ai-sdk/react @vercel/blob recharts
npx shadcn@latest init
```

shadcn init 프롬프트:
- Style: **Default**
- Base color: **Zinc**
- CSS variables: **Yes**

- [ ] **Step 5: shadcn 컴포넌트 추가**

```bash
npx shadcn@latest add button input card badge separator scroll-area
```

- [ ] **Step 6: AI Elements 설치**

```bash
npx ai-elements@latest
```

- [ ] **Step 7: Geist 폰트 설치**

```bash
npm install geist
```

- [ ] **Step 8: Python 서비스 의존성 파일 생성**

`services/data-api/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
duckdb==1.1.0
sqlglot==25.0.0
python-dotenv==1.0.0
httpx==0.27.0
```

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: initialize monorepo structure with Next.js and Python service"
```

---

### Task 2: Next.js 기본 레이아웃 설정

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: layout.tsx — Geist 폰트 + 다크모드 설정**

`apps/web/app/layout.tsx`:
```tsx
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"

export const metadata: Metadata = {
  title: "Sales Analytics",
  description: "AI-powered sales data analysis",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased bg-zinc-950 text-zinc-50`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: globals.css — CSS 변수 다크모드 기본값 설정**

`apps/web/app/globals.css` 상단에 추가:
```css
@layer base {
  :root {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 7%;
    --card-foreground: 0 0% 98%;
    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --primary: 238.7 83.5% 66.7%;
    --primary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;
    --ring: 238.7 83.5% 66.7%;
    --radius: 0.5rem;
  }
}
```

- [ ] **Step 3: next.config.ts 설정**

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

export default nextConfig
```

- [ ] **Step 4: 개발 서버 실행 확인**

```bash
cd apps/web && npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → 기본 Next.js 페이지 표시 확인

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: configure dark mode layout with Geist fonts"
```

---

## Phase 2: Python 데이터 서비스 (Service 2)

### Task 3: Blob Manifest 관리 모듈

**Files:**
- Create: `services/data-api/manifest.py`
- Create: `services/data-api/tests/test_manifest.py`

- [ ] **Step 1: 테스트 먼저 작성**

`services/data-api/tests/test_manifest.py`:
```python
import pytest
import json
import os
from unittest.mock import patch, mock_open

# manifest.py가 없어서 실패해야 함
from manifest import load_blob_urls, save_manifest

def test_load_blob_urls_returns_list():
    sample = {"files": [
        {"url": "https://example.com/file1.parquet", "name": "file1.parquet"},
        {"url": "https://example.com/file2.parquet", "name": "file2.parquet"},
    ]}
    import urllib.request
    mock_resp = MagicMock()
    mock_resp.read.return_value = json.dumps(sample).encode()
    mock_resp.__enter__ = lambda s: s
    mock_resp.__exit__ = MagicMock(return_value=False)
    with patch("urllib.request.urlopen", return_value=mock_resp):
        with patch.dict("os.environ", {"MANIFEST_BLOB_URL": "https://example.com/manifest.json"}):
            import importlib, manifest as m_mod
            importlib.reload(m_mod)
            urls = m_mod.load_blob_urls()
    assert urls == ["https://example.com/file1.parquet", "https://example.com/file2.parquet"]

def test_load_blob_urls_empty():
    with patch.dict("os.environ", {"MANIFEST_BLOB_URL": ""}):
        import importlib, manifest as m_mod
        importlib.reload(m_mod)
        urls = m_mod.load_blob_urls()
    assert urls == []
```

- [ ] **Step 2: pytest 경로 설정 및 테스트 실패 확인**

`services/data-api/conftest.py`:
```python
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
```

```bash
cd services/data-api
pip install -r requirements.txt
pytest tests/test_manifest.py -v
```

Expected: `ImportError: cannot import name 'load_blob_urls'`

- [ ] **Step 3: manifest.py 구현**

`services/data-api/manifest.py`:
```python
import json
import os
from typing import List

MANIFEST_BLOB_URL = os.environ.get("MANIFEST_BLOB_URL", "")

def load_blob_urls() -> List[str]:
    """
    Vercel Blob에 저장된 manifest JSON URL을 HTTP로 읽어 parquet URL 목록 반환.
    Serverless 환경에서 로컬 파일시스템 대신 Blob URL 사용.
    """
    if not MANIFEST_BLOB_URL:
        return []
    import urllib.request
    with urllib.request.urlopen(MANIFEST_BLOB_URL) as resp:
        data = json.loads(resp.read())
    return [item["url"] for item in data.get("files", [])]
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/test_manifest.py -v
```

Expected: 2 PASSED

- [ ] **Step 5: Commit**

```bash
git add services/data-api/manifest.py services/data-api/tests/
git commit -m "feat: add blob manifest management module"
```

---

### Task 4: SQL 보안 레이어

**Files:**
- Create: `services/data-api/security.py`
- Create: `services/data-api/tests/test_security.py`

- [ ] **Step 1: 테스트 먼저 작성**

`services/data-api/tests/test_security.py`:
```python
import pytest
from security import validate_sql, SQLSecurityError

class TestValidSQLs:
    def test_simple_select(self):
        assert validate_sql("SELECT * FROM sales_view LIMIT 10") is True

    def test_select_with_where(self):
        assert validate_sql("SELECT oaccount, del_zip FROM sales_view WHERE oaccount > 10000") is True

    def test_select_with_aggregation(self):
        sql = "SELECT strftime(orderno, '%Y-%m') as month, SUM(oaccount) FROM sales_view GROUP BY 1"
        assert validate_sql(sql) is True

    def test_cte_with_sales_view(self):
        sql = """
        WITH monthly AS (SELECT * FROM sales_view WHERE oaccount > 0)
        SELECT * FROM monthly LIMIT 10
        """
        assert validate_sql(sql) is True

class TestBlockedSQLs:
    def test_blocks_drop(self):
        with pytest.raises(SQLSecurityError, match="DDL"):
            validate_sql("DROP TABLE sales_view")

    def test_blocks_insert(self):
        with pytest.raises(SQLSecurityError, match="DML"):
            validate_sql("INSERT INTO sales_view VALUES (1, 2, 3)")

    def test_blocks_external_url(self):
        with pytest.raises(SQLSecurityError, match="허용되지 않는"):
            validate_sql("SELECT * FROM read_parquet('https://attacker.com/evil.parquet')")

    def test_blocks_local_file(self):
        with pytest.raises(SQLSecurityError, match="허용되지 않는"):
            validate_sql("SELECT * FROM '/etc/passwd'")

    def test_blocks_unknown_table(self):
        with pytest.raises(SQLSecurityError, match="허용되지 않는"):
            validate_sql("SELECT * FROM other_table")

    def test_blocks_pragma(self):
        with pytest.raises(SQLSecurityError, match="DDL"):
            validate_sql("PRAGMA database_list")
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_security.py -v
```

Expected: `ImportError`

- [ ] **Step 3: security.py 구현**

`services/data-api/security.py`:
```python
import sqlglot
import sqlglot.expressions as exp
from typing import Set

ALLOWED_TABLES: Set[str] = {"sales_view"}
DDL_TYPES = (exp.Create, exp.Drop, exp.Alter, exp.TruncateTable)
DML_TYPES = (exp.Insert, exp.Update, exp.Delete, exp.Copy)
BLOCKED_KEYWORDS = {"pragma", "export", "import", "attach", "detach"}


class SQLSecurityError(Exception):
    pass


def validate_sql(sql: str) -> bool:
    """
    SQL을 AST 레벨에서 검증.
    - SELECT만 허용
    - sales_view 외 테이블/URL/파일 차단
    - DDL/DML 차단
    """
    sql_lower = sql.strip().lower()

    # 차단 키워드 빠른 검사
    first_word = sql_lower.split()[0] if sql_lower.split() else ""
    if first_word in BLOCKED_KEYWORDS:
        raise SQLSecurityError(f"DDL/PRAGMA 쿼리는 허용되지 않습니다: {first_word}")

    try:
        statements = sqlglot.parse(sql, dialect="duckdb")
    except Exception as e:
        raise SQLSecurityError(f"SQL 파싱 오류: {e}")

    if not statements:
        raise SQLSecurityError("빈 SQL입니다")

    for stmt in statements:
        # DDL 차단
        if isinstance(stmt, DDL_TYPES):
            raise SQLSecurityError("DDL 쿼리는 허용되지 않습니다")
        # DML 차단
        if isinstance(stmt, DML_TYPES):
            raise SQLSecurityError("DML 쿼리는 허용되지 않습니다")

        # 모든 FROM 절 테이블 이름 검사 (CTE, 서브쿼리 포함)
        for table in stmt.find_all(exp.Table):
            name = table.name.lower() if table.name else ""
            # URL 또는 파일 경로가 포함된 경우 차단
            if any(c in name for c in ["http", "/", "\\", "."]):
                raise SQLSecurityError(f"허용되지 않는 테이블 참조: {name}")
            # read_parquet, read_csv 등 함수 호출 차단
        for func in stmt.find_all(exp.Anonymous):
            if func.name.lower().startswith("read_"):
                raise SQLSecurityError(f"허용되지 않는 함수 호출: {func.name}")

        # 허용된 테이블만 접근 (CTE 이름은 제외)
        cte_names = {
            cte.alias.lower()
            for cte in stmt.find_all(exp.CTE)
        }
        for table in stmt.find_all(exp.Table):
            name = table.name.lower() if table.name else ""
            if name and name not in ALLOWED_TABLES and name not in cte_names:
                raise SQLSecurityError(f"허용되지 않는 테이블: {name}")

    return True
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/test_security.py -v
```

Expected: 11 PASSED

- [ ] **Step 5: Commit**

```bash
git add services/data-api/security.py services/data-api/tests/test_security.py
git commit -m "feat: add AST-based SQL security validation with sqlglot"
```

---

### Task 5: DuckDB 초기화 및 쿼리 모듈

**Files:**
- Create: `services/data-api/db.py`
- Create: `services/data-api/tests/test_db.py`

- [ ] **Step 1: 테스트 먼저 작성**

`services/data-api/tests/test_db.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from db import QueryEngine, QueryResult

def test_query_result_structure():
    result = QueryResult(rows=[{"a": 1}], row_count=1, execution_time_ms=50)
    assert result.rows == [{"a": 1}]
    assert result.row_count == 1
    assert result.execution_time_ms == 50

def test_query_engine_limits_rows():
    engine = QueryEngine.__new__(QueryEngine)
    engine.conn = MagicMock()
    mock_rel = MagicMock()
    mock_rel.fetchall.return_value = [(i,) for i in range(600)]
    mock_rel.description = [("id",)]
    engine.conn.execute.return_value = mock_rel
    with patch("db.validate_sql", return_value=True):
        result = engine.query("SELECT id FROM sales_view")
    assert result.row_count <= 500

def test_query_engine_blocks_invalid_sql():
    from security import SQLSecurityError
    engine = QueryEngine.__new__(QueryEngine)
    engine.conn = MagicMock()
    with patch("db.validate_sql", side_effect=SQLSecurityError("DDL 차단")):
        with pytest.raises(SQLSecurityError):
            engine.query("DROP TABLE sales_view")
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_db.py -v
```

Expected: `ImportError`

- [ ] **Step 3: db.py 구현**

`services/data-api/db.py`:
```python
import duckdb
import time
import os
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from manifest import load_blob_urls
from security import validate_sql

MAX_ROWS = 500

@dataclass
class QueryResult:
    rows: List[Dict[str, Any]]
    row_count: int
    execution_time_ms: float
    summary: Optional[Dict] = None


class QueryEngine:
    _instance: Optional["QueryEngine"] = None

    def __init__(self):
        self.conn = duckdb.connect(database=":memory:", read_only=False)
        self.conn.execute("SET temp_directory='/tmp'")
        self.conn.execute("SET memory_limit='400MB'")
        self.conn.execute("LOAD httpfs")
        self._initialized = False

    @classmethod
    def get(cls) -> "QueryEngine":
        """싱글턴 인스턴스 반환"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self, manifest_path: str = None):
        """blob-manifest.json을 읽어 sales_view 생성"""
        urls = load_blob_urls(manifest_path) if manifest_path else load_blob_urls()
        if not urls:
            raise ValueError("parquet 파일이 없습니다. 먼저 파일을 업로드해 주세요.")

        url_list = str(urls).replace("'", '"')
        self.conn.execute(f"""
            CREATE OR REPLACE VIEW sales_view AS
            SELECT * FROM read_parquet({url_list},
                hive_partitioning=false,
                union_by_name=true)
        """)
        self._initialized = True

    def reload(self, manifest_path: str = None):
        """파일 업로드 후 view 재초기화"""
        self._initialized = False
        self.initialize(manifest_path)

    def get_schema(self) -> Dict:
        """컬럼 목록, 타입, 샘플 데이터 반환"""
        if not self._initialized:
            self.initialize()

        columns_result = self.conn.execute("DESCRIBE sales_view").fetchall()
        total_rows = self.conn.execute("SELECT COUNT(*) FROM sales_view").fetchone()[0]

        columns = []
        for col in columns_result:
            col_name = col[0]
            col_type = col[1]
            null_count = self.conn.execute(
                f"SELECT COUNT(*) FROM sales_view WHERE {col_name} IS NULL"
            ).fetchone()[0]
            columns.append({
                "name": col_name,
                "type": col_type,
                "null_pct": round(null_count / total_rows * 100, 1) if total_rows > 0 else 0,
            })

        sample = self.conn.execute("SELECT * FROM sales_view LIMIT 3").fetchdf().to_dict("records")
        return {
            "columns": columns,
            "total_rows": total_rows,
            "sample": sample,
        }

    def query(self, sql: str) -> QueryResult:
        """SQL 검증 후 실행"""
        if not self._initialized:
            self.initialize()

        validate_sql(sql)  # SQLSecurityError 발생 시 전파

        start = time.time()
        import threading
        result_holder = {}
        error_holder = {}

        def run_query():
            try:
                rel = self.conn.execute(sql)
                columns = [desc[0] for desc in rel.description]
                all_rows = rel.fetchall()
                result_holder["rows"] = [dict(zip(columns, row)) for row in all_rows[:MAX_ROWS]]
            except Exception as e:
                error_holder["error"] = str(e)

        thread = threading.Thread(target=run_query)
        thread.start()
        thread.join(timeout=30)  # 30초 타임아웃

        if thread.is_alive():
            raise RuntimeError("쿼리 타임아웃: 30초를 초과했습니다. 기간을 좁혀 다시 시도해 주세요.")
        if "error" in error_holder:
            raise RuntimeError(f"쿼리 실행 오류: {error_holder['error']}")

        rows = result_holder.get("rows", [])
        elapsed_ms = (time.time() - start) * 1000
        return QueryResult(
            rows=rows,
            row_count=len(rows),
            execution_time_ms=round(elapsed_ms, 1),
        )
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/test_db.py -v
```

Expected: 3 PASSED

- [ ] **Step 5: Commit**

```bash
git add services/data-api/db.py services/data-api/tests/test_db.py
git commit -m "feat: add DuckDB query engine with singleton and 500-row limit"
```

---

### Task 6: FastAPI 앱 (main.py)

**Files:**
- Create: `services/data-api/main.py`
- Create: `services/data-api/.env.example`

- [ ] **Step 1: main.py 구현**

`services/data-api/main.py`:
```python
import os
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from db import QueryEngine
from security import SQLSecurityError
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Sales Data API")
INTERNAL_SECRET = os.environ.get("INTERNAL_API_SECRET", "")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("WEB_URL", "http://localhost:3000")],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


def verify_secret(x_internal_secret: str = Header(...)):
    if not INTERNAL_SECRET or x_internal_secret != INTERNAL_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")


class QueryRequest(BaseModel):
    sql: str


@app.on_event("startup")
async def startup():
    try:
        QueryEngine.get().initialize()
    except Exception as e:
        print(f"[startup] sales_view 초기화 실패 (파일 미업로드 상태일 수 있음): {e}")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/schema", dependencies=[Depends(verify_secret)])
async def get_schema():
    try:
        return QueryEngine.get().get_schema()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/query", dependencies=[Depends(verify_secret)])
async def run_query(req: QueryRequest):
    try:
        result = QueryEngine.get().query(req.sql)
        return {
            "rows": result.rows,
            "row_count": result.row_count,
            "execution_time_ms": result.execution_time_ms,
        }
    except SQLSecurityError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reload", dependencies=[Depends(verify_secret)])
async def reload_view():
    """파일 업로드 후 sales_view 강제 재초기화"""
    try:
        QueryEngine.get().reload()
        return {"status": "reloaded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 2: .env.example 생성**

`services/data-api/.env.example`:
```
INTERNAL_API_SECRET=change-me-to-random-string
WEB_URL=http://localhost:3000
MANIFEST_PATH=../../blob-manifest.json
```

- [ ] **Step 3: 로컬 실행 확인**

빈 manifest.json 임시 생성:
```bash
echo '{"files":[]}' > blob-manifest.json
cd services/data-api
cp .env.example .env
uvicorn main:app --reload --port 8001
```

다른 터미널에서:
```bash
curl http://localhost:8001/health
```
Expected: `{"status":"ok"}`

- [ ] **Step 4: Commit**

```bash
git add services/data-api/main.py services/data-api/.env.example
git commit -m "feat: add FastAPI app with schema, query, and reload endpoints"
```

---

## Phase 3: Next.js AI 레이어

### Task 7: 환경변수 및 AI 시스템 프롬프트

**Files:**
- Create: `apps/web/lib/ai/prompts.ts`
- Create: `apps/web/.env.local.example`

- [ ] **Step 1: 시스템 프롬프트 구현**

`apps/web/lib/ai/prompts.ts`:
```ts
export const SYSTEM_PROMPT = `당신은 e-커머스 판매 데이터 분석 전문가입니다.
사용자의 자연어 질문을 이해하고 DuckDB SQL로 데이터를 조회하여
마케팅 인사이트, 원인 분석, 전략 제안을 제공합니다.

## 데이터 설명 (sales_view)
2019년~현재까지의 주문 데이터입니다.

| 컬럼 | 설명 | 타입 |
|------|------|------|
| orderno | 주문 번호 | string |
| outorderno | 대외 주문 번호 | string |
| oaccount | 주문 금액 (원) | float |
| ouse_account | 실제 사용 금액 | float |
| ouse_mempoint | 멤버십 포인트 사용액 | float |
| odel_account | 배송비 | float |
| delivery_no | 송장 번호 | string |
| delcompany | 배송업체 코드 | string |
| del_zip | 배송지 우편번호 | string |
| del_addr1 | 배송 주소 (시/도) | string |
| del_addr2 | 배송 주소 (상세) | string |
| trs | 거래 구분/결제수단 코드 | string |
| ouse_coupen2 | 쿠폰 사용 금액 | float |
| ouse_advance_point | 선포인트 사용 금액 | float |

## 지침
- 항상 get_schema()로 먼저 전체 컬럼을 확인한 후 쿼리하세요
- SQL은 반드시 sales_view 테이블만 참조하세요
- 쿼리 결과를 분석하여 인사이트와 전략을 한국어로 설명하세요
- 차트가 도움이 될 때는 render_chart()를 사용하세요
- 복잡한 분석은 여러 단계로 나눠 수행하세요
- 날짜 관련 쿼리: DuckDB 날짜 함수 사용 (strptime, date_trunc 등)
`

export const SUGGESTED_QUESTIONS = [
  "월별 전체 매출 추이를 차트로 보여줘",
  "쿠폰 사용 주문과 미사용 주문의 평균 금액 비교",
  "배송비가 가장 많이 발생한 지역 TOP 10",
  "포인트 사용률이 높은 달은 언제야?",
  "2023년 대비 2024년 매출 변화 원인 분석",
  "다음 분기 프로모션 전략 제안해줘",
]
```

- [ ] **Step 2: .env.local.example 생성**

`apps/web/.env.local.example`:
```
# vercel env pull 로 자동 생성됨
VERCEL_OIDC_TOKEN=
BLOB_READ_WRITE_TOKEN=

# 수동 설정 필요
DATA_API_URL=http://localhost:8001
INTERNAL_API_SECRET=change-me-to-random-string
ADMIN_SECRET=admin-password-here
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/ai/prompts.ts apps/web/.env.local.example
git commit -m "feat: add AI system prompt with data dictionary and suggested questions"
```

---

### Task 8: AI 도구 3개 구현

**Files:**
- Create: `apps/web/lib/ai/tools.ts`

- [ ] **Step 1: tools.ts 구현**

`apps/web/lib/ai/tools.ts`:
```ts
import { tool } from "ai"
import { z } from "zod"

const DATA_API_URL = process.env.DATA_API_URL!
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET!

const apiHeaders = {
  "Content-Type": "application/json",
  "x-internal-secret": INTERNAL_SECRET,
}

async function callDataApi(path: string, body?: object) {
  const res = await fetch(`${DATA_API_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: apiHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Data API error (${res.status}): ${err}`)
  }
  return res.json()
}

export const salesTools = {
  get_schema: tool({
    description: "sales_view의 컬럼 목록, 타입, null 비율, 총 행 수, 샘플 데이터를 조회합니다. 분석 시작 시 호출하세요.",
    inputSchema: z.object({}),
    execute: async () => {
      return await callDataApi("/schema")
    },
  }),

  query_data: tool({
    description: "DuckDB SQL을 실행하여 데이터를 조회합니다. sales_view 테이블만 사용 가능합니다. 최대 500행 반환.",
    inputSchema: z.object({
      sql: z.string().describe("실행할 SELECT SQL 문"),
    }),
    execute: async ({ sql }) => {
      return await callDataApi("/query", { sql })
    },
  }),

  render_chart: tool({
    description: "쿼리 결과를 차트로 시각화합니다. query_data 실행 후 차트가 필요할 때 호출하세요.",
    inputSchema: z.object({
      type: z.enum(["line", "bar", "pie", "area"]).describe("차트 타입"),
      data: z.array(z.record(z.unknown())).describe("차트 데이터 배열"),
      title: z.string().describe("차트 제목"),
      xKey: z.string().describe("X축 데이터 키"),
      yKey: z.string().describe("Y축 데이터 키"),
      description: z.string().optional().describe("차트 설명"),
    }),
    execute: async (spec) => {
      // 클라이언트에서 렌더링, 서버는 spec을 그대로 반환
      return { chartSpec: spec }
    },
  }),
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/ai/tools.ts
git commit -m "feat: implement get_schema, query_data, render_chart AI tools"
```

---

### Task 9: 컨텍스트 관리 및 /api/chat 라우트

**Files:**
- Create: `apps/web/lib/ai/context.ts`
- Create: `apps/web/app/api/chat/route.ts`

- [ ] **Step 1: 슬라이딩 윈도우 컨텍스트 관리**

`apps/web/lib/ai/context.ts`:
```ts
import type { UIMessage } from "ai"

const MAX_TURNS = 10

export function trimMessages(messages: UIMessage[]): UIMessage[] {
  if (messages.length <= MAX_TURNS * 2) return messages
  // 시스템 메시지는 유지, 나머지 최근 MAX_TURNS*2개만
  return messages.slice(-MAX_TURNS * 2)
}
```

- [ ] **Step 2: /api/chat 라우트 구현**

`apps/web/app/api/chat/route.ts`:
```ts
import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { SYSTEM_PROMPT } from "@/lib/ai/prompts"
import { salesTools } from "@/lib/ai/tools"
import { trimMessages } from "@/lib/ai/context"
import type { UIMessage } from "ai"

export const maxDuration = 60

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const trimmed = trimMessages(messages)

  const result = streamText({
    model: "anthropic/claude-sonnet-4.6",
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(trimmed),
    tools: salesTools,
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
```

- [ ] **Step 3: 개발 서버에서 API 테스트**

```bash
# apps/web 에서
npm run dev
```

다른 터미널:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":[{"type":"text","text":"안녕"}],"id":"1"}]}'
```

Expected: 스트리밍 응답 (text chunks)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/ai/context.ts apps/web/app/api/chat/route.ts
git commit -m "feat: add /api/chat route with tool calling and sliding window context"
```

---

## Phase 4: 파일 업로드 (Blob)

### Task 10: Blob 업로드 API 및 Manifest 관리 (Next.js)

**Files:**
- Create: `apps/web/lib/blob/manifest.ts`
- Create: `apps/web/app/api/upload/route.ts`
- Create: `apps/web/app/api/reload/route.ts`

- [ ] **Step 1: manifest.ts (Next.js)**

`apps/web/lib/blob/manifest.ts`:
```ts
import { put, list } from "@vercel/blob"

export interface BlobFile {
  url: string
  name: string
  size: number
  uploadedAt: string
}

export async function getManifest(): Promise<BlobFile[]> {
  const { blobs } = await list({ prefix: "parquet/" })
  return blobs
    .filter((b) => b.pathname.endsWith(".parquet"))
    .map((b) => ({
      url: b.url,
      name: b.pathname.replace("parquet/", ""),
      size: b.size,
      uploadedAt: b.uploadedAt.toISOString(),
    }))
}

export async function uploadParquet(file: File): Promise<BlobFile> {
  const blob = await put(`parquet/${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
  })
  return {
    url: blob.url,
    name: file.name,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

/** 업로드 후 manifest.json을 Vercel Blob에 저장 → Python 서비스가 HTTP로 읽을 수 있게 */
export async function publishManifest(): Promise<string> {
  const files = await getManifest()
  const content = JSON.stringify({ files }, null, 2)
  const blob = await put("manifest.json", content, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  })
  return blob.url  // MANIFEST_BLOB_URL 환경변수로 Service 2에 전달
}
```

- [ ] **Step 2: upload API 라우트**

`apps/web/app/api/upload/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server"
import { uploadParquet, publishManifest } from "@/lib/blob/manifest"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get("admin_token")?.value
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File
  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 })
  }

  if (!file.name.endsWith(".parquet")) {
    return NextResponse.json({ error: "parquet 파일만 허용됩니다" }, { status: 400 })
  }

  const result = await uploadParquet(file)
  // 업로드마다 manifest.json을 Vercel Blob에 갱신 → Python 서비스가 HTTP로 읽음
  await publishManifest()
  return NextResponse.json(result)
}
```

- [ ] **Step 3: reload API 라우트**

`apps/web/app/api/reload/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get("admin_token")?.value
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const res = await fetch(`${process.env.DATA_API_URL}/reload`, {
    method: "POST",
    headers: { "x-internal-secret": process.env.INTERNAL_API_SECRET! },
  })

  if (!res.ok) {
    return NextResponse.json({ error: "reload 실패" }, { status: 500 })
  }

  return NextResponse.json({ status: "reloaded" })
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/blob/ apps/web/app/api/upload/ apps/web/app/api/reload/
git commit -m "feat: add Vercel Blob upload API and reload endpoint"
```

---

## Phase 5: 프론트엔드 UI

### Task 11: 차트 컴포넌트

**Files:**
- Create: `apps/web/components/charts/dynamic-chart.tsx`

- [ ] **Step 1: DynamicChart 컴포넌트 구현**

`apps/web/components/charts/dynamic-chart.tsx`:
```tsx
"use client"

import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from "recharts"

type ChartType = "line" | "bar" | "pie" | "area"

interface ChartSpec {
  type: ChartType
  data: Record<string, unknown>[]
  title: string
  xKey: string
  yKey: string
  description?: string
}

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"]

export function DynamicChart({ spec }: { spec: ChartSpec }) {
  const { type, data, title, xKey, yKey, description } = spec

  const commonProps = {
    data,
    margin: { top: 5, right: 20, left: 10, bottom: 5 },
  }

  const renderChart = () => {
    switch (type) {
      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey={xKey} stroke="#a1a1aa" tick={{ fontSize: 12 }} />
            <YAxis stroke="#a1a1aa" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }} />
            <Legend />
            <Line type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2} dot={false} />
          </LineChart>
        )
      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey={xKey} stroke="#a1a1aa" tick={{ fontSize: 12 }} />
            <YAxis stroke="#a1a1aa" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }} />
            <Bar dataKey={yKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        )
      case "area":
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis dataKey={xKey} stroke="#a1a1aa" tick={{ fontSize: 12 }} />
            <YAxis stroke="#a1a1aa" tick={{ fontSize: 12 }} />
            <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }} />
            <Area type="monotone" dataKey={yKey} stroke="#6366f1" fill="#6366f120" />
          </AreaChart>
        )
      case "pie":
        return (
          <PieChart>
            <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={80} label>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46" }} />
            <Legend />
          </PieChart>
        )
    }
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-100 mb-1">{title}</h3>
      {description && <p className="text-xs text-zinc-400 mb-3">{description}</p>}
      <ResponsiveContainer width="100%" height={240}>
        {renderChart() as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/charts/
git commit -m "feat: add DynamicChart component with Recharts (line/bar/area/pie)"
```

---

### Task 12: 채팅 패널 컴포넌트

**Files:**
- Create: `apps/web/components/chat/chat-panel.tsx`
- Create: `apps/web/components/chat/suggested-questions.tsx`

- [ ] **Step 1: 추천 질문 컴포넌트**

`apps/web/components/chat/suggested-questions.tsx`:
```tsx
"use client"

import { Button } from "@/components/ui/button"
import { SUGGESTED_QUESTIONS } from "@/lib/ai/prompts"

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 p-3">
      {SUGGESTED_QUESTIONS.map((q) => (
        <Button
          key={q}
          variant="outline"
          size="sm"
          onClick={() => onSelect(q)}
          className="text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {q}
        </Button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: 채팅 패널 구현**

`apps/web/components/chat/chat-panel.tsx`:
```tsx
"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useEffect, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SuggestedQuestions } from "./suggested-questions"
import { DynamicChart } from "@/components/charts/dynamic-chart"
import { Send } from "lucide-react"

// AI Elements에서 가져오기
// npx ai-elements@latest 실행 후 생성된 실제 경로 확인 필요
// 보통 @/components/ai-elements/message 또는 @/components/ai-elements/message-response
import { MessageResponse } from "@/components/ai-elements/message"

interface ChartSpec {
  type: "line" | "bar" | "pie" | "area"
  data: Record<string, unknown>[]
  title: string
  xKey: string
  yKey: string
  description?: string
}

interface ChatPanelProps {
  onChartGenerated: (spec: ChartSpec) => void
}

export function ChatPanel({ onChartGenerated }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // render_chart tool 결과 감지
  useEffect(() => {
    for (const msg of messages) {
      for (const part of msg.parts ?? []) {
        if (
          part.type === "tool-result" &&
          (part as { toolName?: string }).toolName === "render_chart"
        ) {
          const result = (part as { result?: { chartSpec?: ChartSpec } }).result
          if (result?.chartSpec) {
            onChartGenerated(result.chartSpec)
          }
        }
      }
    }
  }, [messages, onChartGenerated])

  const handleSend = () => {
    if (!inputValue.trim()) return
    sendMessage({ text: inputValue })
    setInputValue("")
  }

  const isLoading = status === "streaming" || status === "submitted"

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            질문을 입력하거나 아래 추천 질문을 선택하세요
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}
          >
            {msg.role === "user" ? (
              <div className="inline-block bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm max-w-[80%]">
                {msg.parts?.map((p, i) =>
                  p.type === "text" ? <span key={i}>{p.text}</span> : null
                )}
              </div>
            ) : (
              <div className="max-w-[90%]">
                <MessageResponse message={msg} />
                {/* 인라인 차트: render_chart 결과 */}
                {msg.parts?.map((p, i) => {
                  if (p.type === "tool-result") {
                    const tp = p as { toolName?: string; result?: { chartSpec?: ChartSpec } }
                    if (tp.toolName === "render_chart" && tp.result?.chartSpec) {
                      return <DynamicChart key={i} spec={tp.result.chartSpec} />
                    }
                  }
                  return null
                })}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="text-zinc-500 text-sm animate-pulse">분석 중...</div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <SuggestedQuestions onSelect={(q) => { setInputValue(q) }} />

      <div className="flex gap-2 p-4 border-t border-zinc-800">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="질문을 입력하세요..."
          className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          disabled={isLoading}
        />
        <Button
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
          size="icon"
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/chat/
git commit -m "feat: add ChatPanel and SuggestedQuestions components"
```

---

### Task 13: 차트 패널 컴포넌트

**Files:**
- Create: `apps/web/components/chat/chart-panel.tsx`

- [ ] **Step 1: 차트 패널 구현 (핀 고정 기능 포함)**

`apps/web/components/chat/chart-panel.tsx`:
```tsx
"use client"

import { useState, useEffect } from "react"
import { DynamicChart } from "@/components/charts/dynamic-chart"
import { Button } from "@/components/ui/button"
import { Pin, PinOff, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ChartSpec {
  type: "line" | "bar" | "pie" | "area"
  data: Record<string, unknown>[]
  title: string
  xKey: string
  yKey: string
  description?: string
}

interface PinnedChart {
  id: string
  spec: ChartSpec
  pinned: boolean
}

interface ChartPanelProps {
  latestChart: ChartSpec | null
}

export function ChartPanel({ latestChart }: ChartPanelProps) {
  const [charts, setCharts] = useState<PinnedChart[]>([])

  // 새 차트가 들어오면 목록에 추가 (useEffect로 렌더 외부에서 처리)
  useEffect(() => {
    if (!latestChart) return
    setCharts((prev) => {
      const last = prev[prev.length - 1]
      if (last && !last.pinned && last.spec.title === latestChart.title) return prev
      return [
        ...prev.filter((c) => c.pinned),
        { id: Date.now().toString(), spec: latestChart, pinned: false },
      ]
    })
  }, [latestChart])

  const togglePin = (id: string) => {
    setCharts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    )
  }

  const remove = (id: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== id))
  }

  const displayed = [
    ...charts.filter((c) => c.pinned),
    ...charts.filter((c) => !c.pinned).slice(-1),
  ]

  return (
    <ScrollArea className="h-full p-4">
      {displayed.length === 0 ? (
        <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
          AI가 차트를 생성하면 여기에 표시됩니다
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((c) => (
            <div key={c.id} className="relative group">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                  onClick={() => togglePin(c.id)}
                  title={c.pinned ? "핀 해제" : "고정"}
                >
                  {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-400 hover:text-red-400"
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {c.pinned && (
                <div className="absolute top-2 left-2 z-10">
                  <Pin className="h-3 w-3 text-indigo-400" />
                </div>
              )}
              <DynamicChart spec={c.spec} />
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/chat/chart-panel.tsx
git commit -m "feat: add ChartPanel with pin and remove functionality"
```

---

### Task 14: 메인 페이지 조합

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: 메인 페이지 구현**

`apps/web/app/page.tsx`:
```tsx
"use client"

import { useState, useCallback } from "react"
import { ChatPanel } from "@/components/chat/chat-panel"
import { ChartPanel } from "@/components/chat/chart-panel"
import { BarChart2 } from "lucide-react"
import Link from "next/link"

interface ChartSpec {
  type: "line" | "bar" | "pie" | "area"
  data: Record<string, unknown>[]
  title: string
  xKey: string
  yKey: string
  description?: string
}

export default function Home() {
  const [latestChart, setLatestChart] = useState<ChartSpec | null>(null)

  const handleChartGenerated = useCallback((spec: ChartSpec) => {
    setLatestChart(spec)
  }, [])

  return (
    <div className="flex flex-col h-screen">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-indigo-400" />
          <span className="font-semibold text-zinc-100 font-mono text-sm">Sales Analytics</span>
        </div>
        <Link
          href="/admin"
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          파일 관리
        </Link>
      </header>

      {/* 본문: 채팅(60%) + 차트(40%) */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[60%] border-r border-zinc-800 flex flex-col overflow-hidden">
          <ChatPanel onChartGenerated={handleChartGenerated} />
        </div>
        <div className="w-[40%] overflow-hidden">
          <ChartPanel latestChart={latestChart} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 개발 서버에서 UI 확인**

```bash
cd apps/web && npm run dev
```

`http://localhost:3000` 접속 → 채팅 + 차트 레이아웃 표시 확인

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: compose main page with chat and chart split layout"
```

---

### Task 15: 어드민 페이지 (파일 업로드)

**Files:**
- Create: `apps/web/app/admin/page.tsx`
- Create: `apps/web/app/admin/login/page.tsx`
- Create: `apps/web/app/api/admin-login/route.ts`
- Create: `apps/web/components/admin/upload-dropzone.tsx`

- [ ] **Step 1: 업로드 드롭존 컴포넌트**

`apps/web/components/admin/upload-dropzone.tsx`:
```tsx
"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, CheckCircle, XCircle, Loader2 } from "lucide-react"

interface UploadResult {
  name: string
  success: boolean
  error?: string
}

export function UploadDropzone() {
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = async (files: FileList) => {
    setUploading(true)
    setResults([])

    const newResults: UploadResult[] = []
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append("file", file)
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData })
        if (res.ok) {
          newResults.push({ name: file.name, success: true })
        } else {
          const err = await res.json()
          newResults.push({ name: file.name, success: false, error: err.error })
        }
      } catch {
        newResults.push({ name: file.name, success: false, error: "네트워크 오류" })
      }
    }
    setResults(newResults)

    // 업로드 완료 후 데이터 서비스 재초기화
    if (newResults.some((r) => r.success)) {
      await fetch("/api/reload", { method: "POST" })
    }

    setUploading(false)
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
          ${dragging ? "border-indigo-500 bg-indigo-950/20" : "border-zinc-700 hover:border-zinc-500"}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-10 w-10 text-zinc-500 mx-auto mb-3" />
        <p className="text-zinc-300 mb-1">parquet 파일을 드래그하거나 클릭하여 업로드</p>
        <p className="text-zinc-500 text-sm">20개 파일, 최대 650MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".parquet"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {uploading && (
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          업로드 중...
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.name} className="flex items-center gap-2 text-sm">
              {r.success
                ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                : <XCircle className="h-4 w-4 text-red-400" />}
              <span className="text-zinc-300 font-mono">{r.name}</span>
              {r.error && <span className="text-red-400">{r.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 어드민 페이지**

`apps/web/app/admin/page.tsx`:
```tsx
import { UploadDropzone } from "@/components/admin/upload-dropzone"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function AdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (token !== process.env.ADMIN_SECRET) {
    redirect("/admin/login")
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> 돌아가기
        </Link>
        <h1 className="text-xl font-semibold text-zinc-100 mb-2">파일 관리</h1>
        <p className="text-zinc-400 text-sm mb-8">parquet 파일을 업로드하면 AI 분석에 즉시 반영됩니다</p>
        <UploadDropzone />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 어드민 로그인 페이지**

`apps/web/app/admin/login/page.tsx`:
```tsx
"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function AdminLoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async () => {
    const res = await fetch("/api/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push("/admin")
    } else {
      setError("비밀번호가 올바르지 않습니다")
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-80 space-y-4">
        <h1 className="text-zinc-100 text-lg font-semibold text-center">어드민 로그인</h1>
        <Input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          className="bg-zinc-900 border-zinc-700"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <Button onClick={handleLogin} className="w-full bg-indigo-600 hover:bg-indigo-700">
          로그인
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 어드민 로그인 API**

`apps/web/app/api/admin-login/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  if (password !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set("admin_token", process.env.ADMIN_SECRET!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: "/",
  })
  return res
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/ apps/web/components/admin/
git commit -m "feat: add admin page with parquet file upload and login"
```

---

## Phase 6: 배포

### Task 16: Vercel 배포 설정 및 첫 배포

**Files:**
- Modify: `vercel.json`
- Create: `.gitignore`

- [ ] **Step 1: .gitignore 설정**

루트 `.gitignore`:
```
.env.local
.env
**/.env.local
**/node_modules/
**/__pycache__/
**/.pytest_cache/
*.pyc
.vercel/
blob-manifest.json
```

- [ ] **Step 2: 환경변수 설정 (사용자가 실행)**

```bash
# 루트 디렉토리에서
vercel env add INTERNAL_API_SECRET production
# 입력값: openssl rand -hex 32 로 생성한 랜덤 문자열

vercel env add ADMIN_SECRET production
# 입력값: 어드민 비밀번호 (팀 내부용)

vercel env add MANIFEST_BLOB_URL production
# 입력값: 첫 배포 후 파일 업로드 시 자동 생성됨 — 일단 빈값으로 설정
```

> **DATA_API_URL 닭-달걀 해결:**
> Vercel Services는 `{SERVICENAME}_URL` 환경변수를 자동으로 생성합니다.
> 첫 배포 후 Vercel 대시보드 → Environment Variables에서
> `DATA_API_URL` 이름으로 `DATA_API_URL` 값을 확인하고 복사하세요.
> 또는 Next.js 코드에서 `process.env.DATA_API_URL`을 Vercel이 자동주입하므로
> 별도 설정 없이 동작할 수 있습니다.

- [ ] **Step 3: 첫 배포 실행 (사용자가 실행)**

```bash
vercel deploy
```

배포 완료 후 출력된 URL 확인

- [ ] **Step 4: DATA_API_URL 업데이트 (사용자가 실행)**

Vercel 대시보드 → 배포된 Service 2 URL 복사 → 환경변수 DATA_API_URL 업데이트:
```bash
vercel env add DATA_API_URL production
# /api/data 경로의 URL 입력
```

- [ ] **Step 5: 프로덕션 배포 (사용자가 실행)**

```bash
vercel deploy --prod
```

- [ ] **Step 6: Password Protection 설정 (사용자가 실행)**

Vercel 대시보드 → 프로젝트 → Settings → Password Protection → Enable → 비밀번호 설정

- [ ] **Step 7: parquet 파일 업로드 (사용자가 실행)**

1. `https://your-domain.vercel.app/admin/login` 접속
2. ADMIN_SECRET 비밀번호로 로그인
3. parquet 파일 20개 드래그 앤 드롭 업로드
4. 업로드 완료 확인

- [ ] **Step 8: 최종 동작 확인 (사용자가 실행)**

1. `https://your-domain.vercel.app` 접속
2. "월별 전체 매출 추이를 차트로 보여줘" 입력
3. AI가 SQL 쿼리 후 차트 생성 확인

- [ ] **Step 9: Commit**

```bash
git add .gitignore vercel.json
git commit -m "feat: complete sales analytics chat implementation"
```

---

## 전체 요약

| Phase | Tasks | 핵심 산출물 |
|-------|-------|------------|
| 1. 초기화 | 1-2 | Next.js + Python 모노레포, Vercel Services 설정 |
| 2. Python 서비스 | 3-6 | DuckDB 쿼리 엔진, SQL 보안, FastAPI |
| 3. AI 레이어 | 7-9 | 시스템 프롬프트, 3개 도구, /api/chat 라우트 |
| 4. 파일 업로드 | 10 | Vercel Blob 업로드, manifest 관리 |
| 5. 프론트엔드 | 11-15 | 차트, 채팅 패널, 메인 페이지, 어드민 |
| 6. 배포 | 16 | Vercel 배포, Password Protection, 파일 업로드 |

## 사용자가 직접 실행해야 하는 단계

1. **사전 준비:** Vercel 계정, CLI 설치, `vercel link`, AI Gateway 활성화, `vercel env pull`
2. **Task 16 Step 2:** 환경변수 3개 설정 (`INTERNAL_API_SECRET`, `ADMIN_SECRET`, `DATA_API_URL`)
3. **Task 16 Step 3-5:** `vercel deploy`, URL 확인, `vercel deploy --prod`
4. **Task 16 Step 6:** Vercel 대시보드 Password Protection 설정
5. **Task 16 Step 7:** 어드민 페이지에서 parquet 20개 업로드
