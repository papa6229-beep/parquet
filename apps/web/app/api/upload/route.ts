import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextRequest, NextResponse } from "next/server"
import { publishManifest } from "@/lib/blob/manifest"
import { cookies } from "next/headers"

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody

  // cookies() only works for browser requests (generate-token), not Vercel webhook calls (upload-completed)
  let adminToken: string | undefined
  try {
    const cookieStore = await cookies()
    adminToken = cookieStore.get("admin_token")?.value
  } catch {
    // webhook call from Vercel servers — no cookies available, that's expected
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (adminToken !== process.env.ADMIN_SECRET) {
          throw new Error("Unauthorized")
        }
        if (!pathname.endsWith(".parquet")) {
          throw new Error("parquet 파일만 허용됩니다")
        }
        return {
          addRandomSuffix: false,
        }
      },
      onUploadCompleted: async () => {
        // Called by Vercel servers after upload — publish manifest so Python service can reload
        // Wrapped in try/catch so webhook always returns 200 (client won't retry on failure)
        try {
          await publishManifest()
        } catch (e) {
          console.error("[upload] publishManifest failed:", e)
        }
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
