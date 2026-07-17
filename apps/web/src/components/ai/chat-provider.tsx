"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { createContext, useContext, useRef, type ReactNode } from "react";

import type { TingLabUIMessage } from "@/lib/chat/types";

/**
 * 共享聊天内核：在 root layout 持有唯一 Chat 实例，让首页 compact 面板与
 * /ai workspace 复用同一会话，跨路由保留消息与生成状态。
 *
 * Chat 实例的 messages / status / error 都存储在实例本身而非组件本地 state，
 * 因此 AiChat 的挂载/卸载不会丢失会话；切换路由只是重新订阅同一实例。
 */
const SharedChatContext = createContext<Chat<TingLabUIMessage> | null>(null);

const idBase = Math.random().toString(36).slice(2, 8);
let tinglabMessageCounter = 0;

function tinglabGenerateId(): string {
  tinglabMessageCounter += 1;
  return `tl-msg-${idBase}-${tinglabMessageCounter.toString(36)}`;
}

type ChatProviderProps = Readonly<{
  children: ReactNode;
}>;

export function ChatProvider({ children }: ChatProviderProps) {
  const ref = useRef<Chat<TingLabUIMessage> | null>(null);
  if (ref.current === null) {
    ref.current = new Chat<TingLabUIMessage>({
      id: "tinglab-shared-chat",
      transport: new DefaultChatTransport({ api: "/api/chat" }),
      generateId: tinglabGenerateId,
    });
  }
  return <SharedChatContext.Provider value={ref.current}>{children}</SharedChatContext.Provider>;
}

export function useSharedChat(): Chat<TingLabUIMessage> {
  const chat = useContext(SharedChatContext);
  if (!chat) {
    throw new Error("useSharedChat 必须在 <ChatProvider> 内部使用。");
  }
  return chat;
}
