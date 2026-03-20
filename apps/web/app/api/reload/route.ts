import { NextRequest, NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { cookies } from "next/headers"
import { getManifest, publishManifest } from "@/lib/blob/manifest"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get("admin_token")?.value
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Publish manifest.json to Blob
  try {
    await publishManifest()
  } catch (e) {
    return NextResponse.json({ error: "manifest 실패", detail: String(e) }, { status: 500 })
  }

  // Get parquet URLs and pass them directly to data API (private blob URLs need auth)
  let dataResult: Record<string, unknown> = {}
  let totalSent = 0
  try {
    const files = await getManifest()
    const urls = files.map((f) => f.url)
    totalSent = urls.length

    const res = await fetch(`${process.env.DATA_API_URL}/reload`, {
      method: "POST",
      headers: {
        "x-internal-secret": process.env.INTERNAL_API_SECRET!,
        "content-type": "application/json",
      },
      body: JSON.stringify({ urls }),
    })
    if (!res.ok) {
      const body = await res.text()
      return NextResponse.json({ error: "reload 실패", status: res.status, body }, { status: 500 })
    }

    // Delete corrupted files from Blob
    dataResult = await res.json()
    if (Array.isArray(dataResult.bad_files) && dataResult.bad_files.length > 0) {
      for (const badUrl of dataResult.bad_files) {
        try { await del(badUrl as string) } catch { /* ignore */ }
      }
      // Re-publish manifest without bad files
      await publishManifest()
    }
  } catch (e) {
    return NextResponse.json({ error: "fetch 실패", detail: String(e) }, { status: 500 })
  }

  return NextResponse.json({ status: "reloaded", ...dataResult, total_sent: totalSent })
}
