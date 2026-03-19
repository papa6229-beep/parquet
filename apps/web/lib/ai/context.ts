import type { UIMessage } from "ai"

const MAX_TURNS = 10

export function trimMessages(messages: UIMessage[]): UIMessage[] {
  if (messages.length <= MAX_TURNS * 2) return messages
  // 시스템 메시지는 유지, 나머지 최근 MAX_TURNS*2개만
  return messages.slice(-MAX_TURNS * 2)
}
