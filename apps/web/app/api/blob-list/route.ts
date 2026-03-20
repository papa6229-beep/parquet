import { list } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get("admin_token")?.value
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { blobs, hasMore, cursor } = await list({ prefix: "parquet/" })
  const files = blobs.map((b) => ({
    pathname: b.pathname,
    size: b.size,
    url: b.url,
  }))

  return NextResponse.json({ files, count: files.length, hasMore, cursor })
}
