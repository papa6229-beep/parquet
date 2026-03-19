import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { SYSTEM_PROMPT } from "@/lib/ai/prompts"
import { salesTools } from "@/lib/ai/tools"
import { trimMessages } from "@/lib/ai/context"
import type { UIMessage } from "ai"

export const maxDuration = 60

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const trimmed = trimMessages(messages)

  const result = streamText({
    model: "anthropic/claude-sonnet-4.6",
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(trimmed),
    tools: salesTools,
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
