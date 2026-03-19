# Sales Analytics Chat — Design Spec
**Date:** 2026-03-19
**Status:** Approved (Rev 3)

---

## 1. 프로젝트 개요

2019년~현재까지의 e-커머스 주문 데이터(shop_newmarketdb) 총 20개 parquet 파일(~650MB)을 기반으로, AI와 채팅하며 마케팅 통계·원인 분석·시각화·전략 수립이 가능한 내부 분석 웹사이트를 구축한다.

**사용자:** 1~20명 내부 팀
**목적:** 자연어 질문으로 데이터를 탐색하고, AI가 SQL 쿼리 생성 → 시각화 → 전략 해설까지 일관된 대화로 처리
**배포:** Vercel (Services, Fluid Compute, Password Protection)

---

## 2. 아키텍처 결정 배경

| 검토된 옵션 | 문제점 | 결론 |
|------------|--------|------|
| `@duckdb/duckdb-wasm` + httpfs | WASM 환경에서 httpfs 미지원, Node.js에서 원격 URL 스캔 불가 (GitHub Issue #686) | 불가 |
| Native `duckdb` Node.js | 패키지 ~80MB, Vercel 50MB 제한 초과 | 불가 |
| Python DuckDB (serverless) | httpfs 완벽 지원, 패키지 ~15MB | **채택** |
| Vercel Blob Private URL | DuckDB httpfs에서 Auth 헤더 불가 | Public URL로 변경 |

**최종 선택:** Vercel Services 아키텍처
- Service 1: Next.js (채팅 UI + AI 오케스트레이션)
- Service 2: Python FastAPI + DuckDB (데이터 쿼리 엔진)
- 두 서비스를 단일 Vercel 프로젝트로 배포

---

## 3. 아키텍처

```
사용자 브라우저
    │ useChat (AI SDK v6)
    ▼
┌─────────────────────────────────────────────────────┐
│  Service 1: Next.js (Vercel, Fluid Compute 60s)     │
│                                                      │
│  /app/page.tsx          — 채팅 + 차트 UI             │
│  /app/admin/page.tsx    — 파일 업로드 어드민          │
│  /app/api/chat/route.ts — AI 스트리밍 엔드포인트      │
│       │                                              │
│       │ AI SDK streamText + tool calling             │
│       │ model: 'anthropic/claude-sonnet-4.6'         │
│       │ (Vercel AI Gateway, OIDC 인증)               │
│       │                                              │
│       │ tools:                                       │
│       │   get_schema()     → fetch → Service 2      │
│       │   query_data(sql)  → fetch → Service 2      │
│       │   render_chart(spec) → 차트 명세 반환         │
└───────┼─────────────────────────────────────────────┘
        │ HTTP (내부 Vercel 네트워크)
        ▼
┌─────────────────────────────────────────────────────┐
│  Service 2: Python FastAPI + DuckDB                  │
│                                                      │
│  POST /query  { sql: string }                       │
│  GET  /schema                                        │
│       │                                              │
│       │ DuckDB (Python, httpfs 확장)                 │
│       │ SELECT * FROM read_parquet(['url1','url2'…]) │
│       │ HTTP Range Request (필요한 컬럼만)            │
│       ▼                                              │
│  Vercel Blob (Public URL, 20 parquet files, ~650MB) │
└─────────────────────────────────────────────────────┘
```

---

## 4. 기술 스택

| 역할 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Next.js (최신 안정, App Router) | Service 1 |
| AI 모델 | Claude via Vercel AI Gateway | `anthropic/claude-sonnet-4.6` |
| AI SDK | `ai` + `@ai-sdk/react` | v6, streamText + useChat |
| 채팅 UI | AI Elements | MessageResponse, Conversation |
| 데이터 엔진 | Python DuckDB (`duckdb` ~15MB) | Service 2, httpfs 완전 지원 |
| 데이터 API | FastAPI + Uvicorn | Service 2 |
| 파일 저장 | Vercel Blob (Public URL) | 사이트 Password Protection으로 보호 |
| 차트 | Recharts | line, bar, pie, area |
| UI 컴포넌트 | shadcn/ui + Tailwind CSS | 다크모드, zinc 톤 |
| 배포 | Vercel Services | 단일 프로젝트, 두 서비스 |
| 폰트 | Geist Sans + Geist Mono | next/font |

---

## 5. Data Dictionary (AI 시스템 프롬프트 포함)

**데이터 소스:** `shop_newmarketdb`, 2019~현재

| 컬럼 | 한국어 설명 | 타입 |
|------|------------|------|
| `orderno` | 주문 번호 | string |
| `outorderno` | 대외 주문 번호 | string |
| `oaccount` | 주문 금액 (원) | float64 |
| `ouse_account` | 실제 사용 금액 | float64 |
| `ouse_mempoint` | 멤버십 포인트 사용액 | float64 |
| `odel_account` | 배송비 | float64 |
| `delivery_no` | 송장 번호 | string |
| `delcompany` | 배송업체 코드 | string |
| `del_zip` | 배송지 우편번호 | string |
| `del_addr1` | 배송 주소 (시/도) | string |
| `del_addr2` | 배송 주소 (상세) | string |
| `trs` | 거래 구분 (결제수단 코드) | string |
| `ouse_coupen2` | 쿠폰 사용 금액 | float64 |
| `ouse_advance_point` | 선포인트 사용 금액 | float64 |

> 실제 parquet 파일을 열어보면 추가 컬럼이 있을 수 있음 — `get_schema()` 도구로 실시간 파악

---

## 6. AI 도구(Tool) 명세

### `get_schema()`
- **목적:** 전체 컬럼 목록, 타입, null 비율, min/max/샘플 파악
- **구현:** Next.js → `GET /schema` (Service 2) → DuckDB DESCRIBE
- **반환:** `{ columns: [{name, type, nullPct, min, max}], totalRows }`
- **호출 시점:** 세션 첫 메시지 시 자동

### `query_data({ sql: string })`
- **목적:** DuckDB SQL 실행
- **구현:** Next.js → `POST /query` (Service 2) → DuckDB
- **입력:** SELECT 문 (AI가 생성)
- **반환:** `{ rows: [...], rowCount, executionTimeMs }` (최대 500행)
- **보안 레이어 (Service 2에서 적용):**
  1. SQL 파싱으로 DDL/DML 키워드 차단 (`CREATE`, `DROP`, `INSERT`, `UPDATE`, `DELETE`, `COPY`, `EXPORT`, `PRAGMA`)
  2. FROM 절: `sales_view` 단일 뷰만 허용 (외부 URL/파일 경로 차단)
  3. **AST 기반 파싱** (`sqlglot` 라이브러리): FROM 절을 AST 레벨에서 순회해 `sales_view` 외 테이블/URL/파일 경로 차단 (CTE, 서브쿼리 포함)
  4. DuckDB 세션: `httpfs` 외 확장 비활성화, 로컬 파일시스템 접근 차단
  5. 쿼리 타임아웃: 30초
- **에러:** 타임아웃/실패 시 사용자 친화적 메시지 반환

### `render_chart({ type, data, title, xKey, yKey, description })`
- **목적:** AI가 차트 명세 지정 → 클라이언트 Recharts 렌더링
- **지원 타입:** `line` | `bar` | `pie` | `area`
- **구현:** Service 2 불필요, AI SDK tool result를 클라이언트가 직접 해석

---

## 7. Service 2 — Python 데이터 API 상세

```
services/data-api/
├── main.py          — FastAPI 앱, /query, /schema 엔드포인트
├── db.py            — DuckDB 초기화, sales_view 생성, 싱글턴 관리
├── security.py      — SQL 검증 (DDL 차단, 뷰 화이트리스트)
├── manifest.py      — blob-manifest.json 읽기, Blob URL 목록 관리
├── requirements.txt — duckdb, fastapi, uvicorn
└── vercel.json      — Python 런타임 설정
```

**DuckDB 초기화 (startup):**
```python
# blob-manifest.json에서 URL 목록 읽기
urls = load_manifest()  # ["https://blob.vercel-storage.com/file1.parquet", ...]
conn.execute(f"""
  CREATE VIEW sales_view AS
  SELECT * FROM read_parquet({urls})
""")
```

**동시 접근:** DuckDB read-only 모드 + 연결 풀링 (최대 5 연결)

**DuckDB 메모리/임시파일 설정 (db.py에 명시):**
```python
conn.execute("SET temp_directory='/tmp'")
conn.execute("SET memory_limit='400MB'")  # Vercel /tmp 512MB 제한 고려
```

**Cold Start 대응:**
- `read_parquet(urls, hive_partitioning=false, union_by_name=true)` — footer 파싱 최소화
- ~~Vercel Fluid Compute `minInstances: 1` 설정~~ — Vercel Services 미지원 필드, 제외

---

## 8. 컨텍스트 관리 (토큰/비용 제어)

- **대화 히스토리:** 최근 10턴 슬라이딩 윈도우
- **쿼리 결과:** 최대 500행, AI에는 `{ summary_stats, sample: 10 rows }` 우선 전달
- **Tool steps:** `stopWhen: stepCountIs(5)` (보수적 시작, 이후 조정)
- **모니터링:** Vercel AI Gateway 대시보드에서 토큰/비용 추적

---

## 9. UI 레이아웃

```
┌────────────────────────────────────────────────────┐
│  헤더: 로고 | 날짜 범위 필터 | [파일 관리] 버튼     │
├─────────────────────────┬──────────────────────────┤
│                         │                          │
│   채팅 영역 (60%)        │   차트 패널 (40%)         │
│                         │                          │
│   · AI 응답:             │   · render_chart 호출 시  │
│     Markdown + 인라인   │     Recharts 자동 렌더링  │
│     차트                │   · 핀 고정으로 여러      │
│   · 추천 질문 칩         │     차트 비교 가능        │
│                         │                          │
├─────────────────────────┴──────────────────────────┤
│  입력창 | [월별 매출] [쿠폰 효과] [지역 분석] ...    │
└────────────────────────────────────────────────────┘
```

**디자인 원칙:**
- 다크모드 기본 (zinc-950 배경, zinc-900 카드)
- 포인트 컬러: indigo-500 단일
- Geist Sans (UI) + Geist Mono (숫자, SQL 코드)
- 불필요한 장식 없는 데이터 중심 레이아웃

---

## 10. 인증 및 접근 제어

| 영역 | 방식 |
|------|------|
| 사이트 전체 | Vercel Password Protection |
| Blob URL (Public) | 사이트 보호로 간접 보호 (내부 도구, 허용 수준) |
| 어드민 업로드 | `ADMIN_SECRET` 환경변수 쿠키 검증 |
| Service 2 API | `INTERNAL_API_SECRET` 헤더 검증 (Service 1 ↔ Service 2 내부 통신) |

---

## 11. 파일 업로드 플로우

1. `/admin` 접근 → `ADMIN_SECRET` 쿠키 확인
2. 드래그 앤 드롭 → `/api/upload` → `@vercel/blob` put (Public)
3. 업로드 완료 후 단일 API 호출로 `blob-manifest.json` 원자적 재생성 (race condition 방지)
4. 업로드 완료 후 Service 2의 `POST /reload` 엔드포인트 호출 → `sales_view` 즉시 재초기화
   (Serverless 인스턴스는 자동 재시작되지 않으므로 명시적 reload 필수)

---

## 12. 에러 처리

| 케이스 | 처리 |
|--------|------|
| SQL 타임아웃 (30s) | "쿼리가 너무 복잡합니다. 기간을 좁혀 시도해 주세요" |
| SQL 보안 위반 | "허용되지 않는 쿼리입니다" (구체적 이유 미노출) |
| Blob 파일 접근 실패 | "데이터 파일 연결 오류. 관리자에게 문의하세요" |
| AI 응답 실패 | 1회 자동 재시도 후 오류 메시지 |
| 빈 결과 | "해당 조건의 데이터가 없습니다. 다른 기간을 시도해 보세요" |
| Service 2 다운 | "데이터 서비스 일시 오류. 잠시 후 다시 시도해 주세요" |

---

## 13. 추천 질문 예시

- "월별 전체 매출 추이를 차트로 보여줘"
- "쿠폰 사용 주문과 미사용 주문의 평균 금액 비교"
- "배송비가 가장 많이 발생한 지역 TOP 10"
- "포인트 사용률이 높은 달은 언제야?"
- "2023년 대비 2024년 매출 변화 원인 분석해줘"
- "다음 분기 프로모션 전략 제안해줘"

---

## 14. 루트 vercel.json 구성

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

---

## 15. 구현 단계

1. **프로젝트 초기화** — Next.js 생성, Vercel 연결, AI Gateway 활성화, `vercel env pull`
2. **Vercel Blob 설정** — Public 업로드 어드민 페이지 (ADMIN_SECRET 보호), manifest 관리
3. **Service 2 구현** — FastAPI + DuckDB, `/query`, `/schema` 엔드포인트, SQL 보안
4. **AI 도구 3개 구현** — `get_schema`, `query_data`, `render_chart`
5. **`/api/chat` 라우트** — streamText + tool calling + 슬라이딩 윈도우
6. **채팅 UI** — AI Elements + shadcn/ui 레이아웃
7. **차트 패널** — Recharts + render_chart 연동
8. **추천 질문 칩 + 날짜 필터**
9. **Vercel 배포** — Fluid Compute 설정, Password Protection, Services 구성

---

## 16. 사용자가 직접 해야 할 작업 (구현 중 단계별 안내)

- [ ] Vercel 계정 생성 (없는 경우)
- [ ] `npm i -g vercel` 설치
- [ ] `vercel link` 실행 후 `vercel env pull`
- [ ] AI Gateway 대시보드에서 활성화
- [ ] 어드민 페이지에서 parquet 파일 20개 업로드
- [ ] Vercel 대시보드에서 Password Protection 설정
