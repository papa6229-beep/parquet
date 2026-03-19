import { UploadDropzone } from "@/components/admin/upload-dropzone"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function AdminPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (token !== process.env.ADMIN_SECRET) {
    redirect("/admin/login")
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-sm mb-6">
          <ArrowLeft className="h-4 w-4" /> 돌아가기
        </Link>
        <h1 className="text-xl font-semibold text-zinc-100 mb-2">파일 관리</h1>
        <p className="text-zinc-400 text-sm mb-8">parquet 파일을 업로드하면 AI 분석에 즉시 반영됩니다</p>
        <UploadDropzone />
      </div>
    </div>
  )
}
