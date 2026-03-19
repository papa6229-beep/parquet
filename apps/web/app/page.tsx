"use client"

import { useState, useCallback } from "react"
import { ChatPanel } from "@/components/chat/chat-panel"
import { ChartPanel } from "@/components/chat/chart-panel"
import { BarChart2 } from "lucide-react"
import Link from "next/link"

interface ChartSpec {
  type: "line" | "bar" | "pie" | "area"
  data: Record<string, unknown>[]
  title: string
  xKey: string
  yKey: string
  description?: string
}

export default function Home() {
  const [latestChart, setLatestChart] = useState<ChartSpec | null>(null)

  const handleChartGenerated = useCallback((spec: ChartSpec) => {
    setLatestChart(spec)
  }, [])

  return (
    <div className="flex flex-col h-screen">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-indigo-400" />
          <span className="font-semibold text-zinc-100 font-mono text-sm">Sales Analytics</span>
        </div>
        <Link
          href="/admin"
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          파일 관리
        </Link>
      </header>

      {/* 본문: 채팅(60%) + 차트(40%) */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[60%] border-r border-zinc-800 flex flex-col overflow-hidden">
          <ChatPanel onChartGenerated={handleChartGenerated} />
        </div>
        <div className="w-[40%] overflow-hidden">
          <ChartPanel latestChart={latestChart} />
        </div>
      </div>
    </div>
  )
}
