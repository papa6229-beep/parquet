import { tool } from "ai"
import { z } from "zod"

if (!process.env.DATA_API_URL) throw new Error("DATA_API_URL env var is not set")
if (!process.env.INTERNAL_API_SECRET) throw new Error("INTERNAL_API_SECRET env var is not set")

const DATA_API_URL = process.env.DATA_API_URL
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET

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
