import { NextRequest, NextResponse } from "next/server"
import { uploadParquet, publishManifest } from "@/lib/blob/manifest"
import { cookies } from "next/headers"

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const adminToken = cookieStore.get("admin_token")?.value
  if (adminToken !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File
  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 })
  }

  if (!file.name.endsWith(".parquet")) {
    return NextResponse.json({ error: "parquet 파일만 허용됩니다" }, { status: 400 })
  }

  const result = await uploadParquet(file)
  // 업로드마다 manifest.json을 Vercel Blob에 갱신 → Python 서비스가 HTTP로 읽음
  await publishManifest()
  return NextResponse.json(result)
}
