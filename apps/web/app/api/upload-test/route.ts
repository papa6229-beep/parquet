import { put } from "@vercel/blob"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// Diagnostic endpoint: test server-side upload to Blob
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get("admin_token")?.value
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Test a tiny upload directly from the server (no CORS involved)
    const testBlob = await put("parquet/_test.txt", "hello", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    return NextResponse.json({
      success: true,
      url: testBlob.url,
      pathname: testBlob.pathname,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "unknown",
    }, { status: 500 })
  }
}
