"use client"

import { useState, useEffect } from "react"
import { DynamicChart } from "@/components/charts/dynamic-chart"
import { Button } from "@/components/ui/button"
import { Pin, PinOff, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ChartSpec {
  type: "line" | "bar" | "pie" | "area"
  data: Record<string, unknown>[]
  title: string
  xKey: string
  yKey: string
  description?: string
}

interface PinnedChart {
  id: string
  spec: ChartSpec
  pinned: boolean
}

interface ChartPanelProps {
  latestChart: ChartSpec | null
}

export function ChartPanel({ latestChart }: ChartPanelProps) {
  const [charts, setCharts] = useState<PinnedChart[]>([])

  // 새 차트가 들어오면 목록에 추가 (useEffect로 렌더 외부에서 처리)
  useEffect(() => {
    if (!latestChart) return
    setCharts((prev) => {
      return [
        ...prev.filter((c) => c.pinned),
        { id: Date.now().toString(), spec: latestChart, pinned: false },
      ]
    })
  }, [latestChart])

  const togglePin = (id: string) => {
    setCharts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    )
  }

  const remove = (id: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== id))
  }

  const displayed = [
    ...charts.filter((c) => c.pinned),
    ...charts.filter((c) => !c.pinned).slice(-1),
  ]

  return (
    <ScrollArea className="h-full p-4">
      {displayed.length === 0 ? (
        <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
          AI가 차트를 생성하면 여기에 표시됩니다
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((c) => (
            <div key={c.id} className="relative group">
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-400 hover:text-zinc-100"
                  onClick={() => togglePin(c.id)}
                  title={c.pinned ? "핀 해제" : "고정"}
                >
                  {c.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-zinc-400 hover:text-red-400"
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {c.pinned && (
                <div className="absolute top-2 left-2 z-10">
                  <Pin className="h-3 w-3 text-indigo-400" />
                </div>
              )}
              <DynamicChart spec={c.spec} />
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  )
}
