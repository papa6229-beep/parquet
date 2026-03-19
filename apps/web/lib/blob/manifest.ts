import { put, list } from "@vercel/blob"

export interface BlobFile {
  url: string
  name: string
  size: number
  uploadedAt: string
}

export async function getManifest(): Promise<BlobFile[]> {
  const { blobs } = await list({ prefix: "parquet/" })
  return blobs
    .filter((b) => b.pathname.endsWith(".parquet"))
    .map((b) => ({
      url: b.url,
      name: b.pathname.replace("parquet/", ""),
      size: b.size,
      uploadedAt: b.uploadedAt.toISOString(),
    }))
}

export async function uploadParquet(file: File): Promise<BlobFile> {
  const blob = await put(`parquet/${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
  })
  return {
    url: blob.url,
    name: file.name,
    size: file.size,
    uploadedAt: new Date().toISOString(),
  }
}

/** 업로드 후 manifest.json을 Vercel Blob에 저장 → Python 서비스가 HTTP로 읽을 수 있게 */
export async function publishManifest(): Promise<string> {
  const files = await getManifest()
  const content = JSON.stringify({ files }, null, 2)
  const blob = await put("manifest.json", content, {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  })
  return blob.url  // MANIFEST_BLOB_URL 환경변수로 Service 2에 전달
}
