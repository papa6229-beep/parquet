import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextRequest, NextResponse } from "next/server"
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
      // No onUploadCompleted — omitting it prevents Vercel from embedding
      // a callbackUrl in the client token, so no server-to-server webhook
      // is needed and the upload completes cleanly. Manifest publishing
      // happens in /api/reload (called by the client after all uploads finish).
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
