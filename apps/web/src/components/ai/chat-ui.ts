import type { PublicRagSource, RagStatus } from "@ting-lab/retrieval";

import type { TingLabUIMessage } from "@/lib/chat/types";

export const suggestedQuestions = [
  "如何设计一个可维护的前端状态层？",
  "Next.js 的静态生成与 SSR 有什么区别？",
  "如何设计流式聊天的错误恢复？",
] as const;

export function getMessageText(message: TingLabUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function getMessageSources(message: TingLabUIMessage): PublicRagSource[] {
  return message.parts.find((part) => part.type === "data-sources")?.data ?? [];
}

export function getMessageRagStatus(message: TingLabUIMessage): RagStatus | undefined {
  return message.parts.find((part) => part.type === "data-ragStatus")?.data;
}

export function formatRagStatus(status: RagStatus | undefined): string {
  if (!status) return "博客知识库按需检索";
  if (status.status === "used") return `参考了 ${status.sourceCount} 篇博客内容`;
  if (status.status === "no_match") return "博客中未找到可靠内容";
  return status.reason === "not_configured" ? "本次未使用博客知识库" : "博客知识库暂不可用";
}
