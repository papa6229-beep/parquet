import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextRequest, NextResponse } from "next/server"
import { publishManifest } from "@/lib/blob/manifest"
import { cookies } from "next/headers"

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Auth check on token generation request (comes from browser with cookies)
        const cookieStore = await cookies()
        const adminToken = cookieStore.get("admin_token")?.value
        if (adminToken !== process.env.ADMIN_SECRET) {
          throw new Error("Unauthorized")
        }
        if (!pathname.endsWith(".parquet")) {
          throw new Error("parquet 파일만 허용됩니다")
        }
        return {
          allowedContentTypes: ["application/octet-stream", "application/x-parquet"],
          addRandomSuffix: false,
        }
      },
      onUploadCompleted: async () => {
        // Called by Vercel servers after each file upload completes
        // Publishes updated manifest.json so Python service can reload
        await publishManifest()
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
