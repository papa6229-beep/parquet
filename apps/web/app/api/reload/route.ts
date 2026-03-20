import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { publishManifest } from "@/lib/blob/manifest"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get("admin_token")?.value
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Publish manifest.json to Blob so Python service can read updated parquet URLs
  try {
    await publishManifest()
  } catch (e) {
    return NextResponse.json({ error: "manifest 실패", detail: String(e) }, { status: 500 })
  }

  try {
    const res = await fetch(`${process.env.DATA_API_URL}/reload`, {
      method: "POST",
      headers: { "x-internal-secret": process.env.INTERNAL_API_SECRET! },
    })
    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: "reload 실패", status: res.status, body }, { status: 500 })
    }
  } catch (e) {
    return NextResponse.json({ error: "fetch 실패", detail: String(e) }, { status: 500 })
  }

  return NextResponse.json({ status: "reloaded" })
}
