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
  status: string
}

export function UploadDropzone() {
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [progress, setProgress] = useState<FileProgress[]>([])
  const [dragging, setDragging] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const log = (msg: string) => {
    const ts = new Date().toISOString().slice(11, 23)
    setDebugLog((prev) => [...prev.slice(-19), `[${ts}] ${msg}`])
  }

  const uploadFiles = async (files: FileList) => {
    setUploading(true)
    setResults([])
    setProgress([])
    setDebugLog([])

    const fileList = Array.from(files)
    const newResults: UploadResult[] = []

    for (const file of fileList) {
      log(`START ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
      setProgress((prev) => [...prev, { name: file.name, progress: 0, status: "토큰 요청 중..." }])
      try {
        log("토큰 요청 중...")
        const blob = await upload(`parquet/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          multipart: true,
          onUploadProgress: ({ loaded, total, percentage }) => {
            log(`progress: ${percentage}% (${(loaded/1024/1024).toFixed(1)}/${(total/1024/1024).toFixed(1)}MB)`)
            setProgress((prev) =>
              prev.map((p) => p.name === file.name
                ? { ...p, progress: percentage, status: `업로드 중 ${percentage}%` }
                : p)
            )
          },
        })
        log(`SUCCESS url=${blob.url}`)
        newResults.push({ name: file.name, success: true })
      } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        log(`ERROR ${msg}`)
        newResults.push({
          name: file.name,
          success: false,
          error: msg,
        })
      }
    }

    setResults(newResults)
    setProgress([])

    // 업로드 완료 후 데이터 서비스 재초기화
    if (newResults.some((r) => r.success)) {
      log("reload 호출 중...")
      try {
        await fetch("/api/reload", { method: "POST" })
        log("reload 완료")
      } catch (e) {
        log(`reload 실패: ${e}`)
      }
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
                <span className="font-mono truncate max-w-[60%]">{p.name}</span>
                <span>{p.status}</span>
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

      {/* 디버그 로그 */}
      {debugLog.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 max-h-48 overflow-y-auto">
          <p className="text-xs text-zinc-500 mb-1 font-semibold">Debug Log</p>
          {debugLog.map((line, i) => (
            <p key={i} className={`text-xs font-mono ${line.includes("ERROR") ? "text-red-400" : line.includes("SUCCESS") ? "text-emerald-400" : "text-zinc-400"}`}>
              {line}
            </p>
          ))}
        </div>
      )}

      {/* 완료 결과 */}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.name} className="flex items-start gap-2 text-sm">
              {r.success
                ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                : <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />}
              <div>
                <span className="text-zinc-300 font-mono">{r.name}</span>
                {r.error && <p className="text-red-400 text-xs mt-0.5 break-all">{r.error}</p>}
              </div>
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
