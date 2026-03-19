"use client"

import { Button } from "@/components/ui/button"
import { SUGGESTED_QUESTIONS } from "@/lib/ai/prompts"

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 p-3">
      {SUGGESTED_QUESTIONS.map((q) => (
        <Button
          key={q}
          variant="outline"
          size="sm"
          onClick={() => onSelect(q)}
          className="text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          {q}
        </Button>
      ))}
    </div>
  )
}
