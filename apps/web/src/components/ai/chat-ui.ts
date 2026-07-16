import type { UIMessage } from "ai";

export const suggestedQuestions = [
  "如何设计一个可维护的前端状态层？",
  "Next.js 的静态生成与 SSR 有什么区别？",
  "如何设计流式聊天的错误恢复？",
] as const;

export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
