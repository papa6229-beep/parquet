import { list, del } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get("admin_token")?.value
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { blobs } = await list({ prefix: "parquet/" })
  const deleted: string[] = []
  for (const blob of blobs) {
    if (blob.pathname.endsWith(".parquet")) {
      await del(blob.url)
      deleted.push(blob.pathname)
    }
  }

  return NextResponse.json({ deleted, count: deleted.length })
}
