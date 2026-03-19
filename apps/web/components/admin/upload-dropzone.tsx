"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, CheckCircle, XCircle, Loader2 } from "lucide-react"

interface UploadResult {
  name: string
  success: boolean
  error?: string
}

export function UploadDropzone() {
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = async (files: FileList) => {
    setUploading(true)
    setResults([])

    const newResults: UploadResult[] = []
    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append("file", file)
      try {
        const res = await fetch("/api/upload", { method: "POST", body: formData })
        if (res.ok) {
          newResults.push({ name: file.name, success: true })
        } else {
          const err = await res.json()
          newResults.push({ name: file.name, success: false, error: err.error })
        }
      } catch {
        newResults.push({ name: file.name, success: false, error: "네트워크 오류" })
      }
    }
    setResults(newResults)

    // 업로드 완료 후 데이터 서비스 재초기화
    if (newResults.some((r) => r.success)) {
      await fetch("/api/reload", { method: "POST" })
    }

    setUploading(false)
  }

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer
          ${dragging ? "border-indigo-500 bg-indigo-950/20" : "border-zinc-700 hover:border-zinc-500"}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-10 w-10 text-zinc-500 mx-auto mb-3" />
        <p className="text-zinc-300 mb-1">parquet 파일을 드래그하거나 클릭하여 업로드</p>
        <p className="text-zinc-500 text-sm">20개 파일, 최대 650MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".parquet"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {uploading && (
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          업로드 중...
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.name} className="flex items-center gap-2 text-sm">
              {r.success
                ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                : <XCircle className="h-4 w-4 text-red-400" />}
              <span className="text-zinc-300 font-mono">{r.name}</span>
              {r.error && <span className="text-red-400">{r.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
