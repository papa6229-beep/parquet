"use client"

import { useState, useRef } from "react"
import { upload } from "@vercel/blob/client"
import { CheckCircle, XCircle, Loader2, Upload } from "lucide-react"

interface UploadResult {
  name: string
  success: boolean
  error?: string
}

interface FileProgress {
  name: string
  progress: number
}

export function UploadDropzone() {
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [progress, setProgress] = useState<FileProgress[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const uploadFiles = async (files: FileList) => {
    setUploading(true)
    setResults([])
    setProgress([])

    const fileList = Array.from(files)
    const newResults: UploadResult[] = []

    for (const file of fileList) {
      setProgress((prev) => [...prev, { name: file.name, progress: 0 }])
      try {
        await upload(`parquet/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          onUploadProgress: ({ percentage }) => {
            setProgress((prev) =>
              prev.map((p) => p.name === file.name ? { ...p, progress: percentage } : p)
            )
          },
        })
        newResults.push({ name: file.name, success: true })
      } catch (err) {
        newResults.push({
          name: file.name,
          success: false,
          error: err instanceof Error ? err.message : "업로드 실패",
        })
      }
    }

    setResults(newResults)
    setProgress([])

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
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <Upload className="h-10 w-10 text-zinc-500 mx-auto mb-3" />
        <p className="text-zinc-300 mb-1">parquet 파일을 드래그하거나 클릭하여 업로드</p>
        <p className="text-zinc-500 text-sm">파일당 최대 5GB, 여러 파일 동시 선택 가능</p>
        <input
          ref={inputRef}
          type="file"
          accept=".parquet"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* 업로드 진행 상황 */}
      {progress.length > 0 && (
        <div className="space-y-3">
          {progress.map((p) => (
            <div key={p.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono truncate max-w-[80%]">{p.name}</span>
                <span>{p.progress}%</span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-200"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            업로드 중... 창을 닫지 마세요
          </div>
        </div>
      )}

      {/* 완료 결과 */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.name} className="flex items-center gap-2 text-sm">
              {r.success
                ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
              <span className="text-zinc-300 font-mono truncate">{r.name}</span>
              {r.error && <span className="text-red-400 text-xs">{r.error}</span>}
            </div>
          ))}
          {results.every((r) => r.success) && (
            <p className="text-emerald-400 text-sm mt-2">✓ 모든 파일 업로드 완료. AI 분석에 즉시 반영됩니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
