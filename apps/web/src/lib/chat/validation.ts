import { safeValidateUIMessages } from "ai";
import { z } from "zod";

import { ChatRequestError } from "./errors";
import type { TingLabUIMessage } from "./types";

const MAX_MESSAGES = 20;
const MAX_USER_TEXT_LENGTH = 4000;
const MAX_TOTAL_TEXT_LENGTH = 12000;

const chatRequestSchema = z
  .object({
    id: z.string().min(1).max(128),
    messages: z.unknown(),
    trigger: z.enum(["submit-message", "regenerate-message"]),
    messageId: z.string().min(1).max(128).optional(),
  })
  .strict();

export type ValidatedChatRequest = Readonly<{
  id: string;
  messages: TingLabUIMessage[];
  trigger: "submit-message" | "regenerate-message";
  messageId?: string;
}>;

export async function validateChatRequest(input: unknown): Promise<ValidatedChatRequest> {
  const body = chatRequestSchema.safeParse(input);

  if (!body.success) {
    throw new ChatRequestError("请求格式无效。");
  }

  const validated = await safeValidateUIMessages({ messages: body.data.messages });
  if (!validated.success) {
    throw new ChatRequestError("消息格式无效。");
  }

  const messages = validated.data as TingLabUIMessage[];
  if (messages.length === 0) {
    throw new ChatRequestError("请输入问题后再发送。");
  }
  if (messages.length > MAX_MESSAGES) {
    throw new ChatRequestError(`单次会话最多包含 ${MAX_MESSAGES} 条消息。`);
  }

  let totalTextLength = 0;
  let hasUserQuestion = false;

  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") {
      throw new ChatRequestError("不支持客户端 system 消息。");
    }

    if (
      message.parts.length === 0 ||
      (message.role === "user" && message.parts.some((part) => part.type !== "text"))
    ) {
      throw new ChatRequestError("当前仅支持纯文本消息。");
    }

    const text = message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
    totalTextLength += text.length;

    if (message.role === "user") {
      if (text.trim().length === 0) {
        throw new ChatRequestError("问题不能为空。");
      }
      if (text.length > MAX_USER_TEXT_LENGTH) {
        throw new ChatRequestError(`单条问题不能超过 ${MAX_USER_TEXT_LENGTH} 个字符。`);
      }
      hasUserQuestion = true;
    }
  }

  if (!hasUserQuestion) {
    throw new ChatRequestError("会话中必须包含用户问题。");
  }
  if (totalTextLength > MAX_TOTAL_TEXT_LENGTH) {
    throw new ChatRequestError(`会话文本总长度不能超过 ${MAX_TOTAL_TEXT_LENGTH} 个字符。`);
  }

  const sanitizedMessages: TingLabUIMessage[] = messages.map((message) => ({
    id: message.id,
    role: message.role,
    parts: message.parts.filter((part) => part.type === "text"),
  }));

  return { ...body.data, messages: sanitizedMessages };
}
