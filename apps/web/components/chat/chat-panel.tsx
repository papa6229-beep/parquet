"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRef, useEffect, useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SuggestedQuestions } from "./suggested-questions"
import { DynamicChart } from "@/components/charts/dynamic-chart"
import { Send } from "lucide-react"
import { MessageResponse } from "@/components/ai-elements/message"

interface ChartSpec {
  type: "line" | "bar" | "pie" | "area"
  data: Record<string, unknown>[]
  title: string
  xKey: string
  yKey: string
  description?: string
}

interface ChatPanelProps {
  onChartGenerated: (spec: ChartSpec) => void
}

export function ChatPanel({ onChartGenerated }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // render_chart tool 결과 감지
  useEffect(() => {
    for (const msg of messages) {
      for (const part of msg.parts ?? []) {
        if (
          part.type === "tool-result" &&
          (part as { toolName?: string }).toolName === "render_chart"
        ) {
          const result = (part as { result?: { chartSpec?: ChartSpec } }).result
          if (result?.chartSpec) {
            onChartGenerated(result.chartSpec)
          }
        }
      }
    }
  }, [messages, onChartGenerated])

  const handleSend = () => {
    if (!inputValue.trim()) return
    sendMessage({ text: inputValue })
    setInputValue("")
  }

  const isLoading = status === "streaming" || status === "submitted"

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            질문을 입력하거나 아래 추천 질문을 선택하세요
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-4 ${msg.role === "user" ? "text-right" : "text-left"}`}
          >
            {msg.role === "user" ? (
              <div className="inline-block bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm max-w-[80%]">
                {msg.parts?.map((p, i) =>
                  p.type === "text" ? <span key={i}>{p.text}</span> : null
                )}
              </div>
            ) : (
              <div className="max-w-[90%]">
                <MessageResponse message={msg} />
                {/* 인라인 차트: render_chart 결과 */}
                {msg.parts?.map((p, i) => {
                  if (p.type === "tool-result") {
                    const tp = p as { toolName?: string; result?: { chartSpec?: ChartSpec } }
                    if (tp.toolName === "render_chart" && tp.result?.chartSpec) {
                      return <DynamicChart key={i} spec={tp.result.chartSpec} />
                    }
                  }
                  return null
                })}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="text-zinc-500 text-sm animate-pulse">분석 중...</div>
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      <SuggestedQuestions onSelect={(q) => { setInputValue(q) }} />

      <div className="flex gap-2 p-4 border-t border-zinc-800">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="질문을 입력하세요..."
          className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
          disabled={isLoading}
        />
        <Button
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
          size="icon"
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
