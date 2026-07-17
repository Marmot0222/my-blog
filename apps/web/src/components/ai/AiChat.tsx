"use client";

import { useChat } from "@ai-sdk/react";
import type { PublicRagSource } from "@ting-lab/retrieval";
import { useCallback, useEffect, useRef, useState } from "react";

import { parseClientChatError } from "@/lib/chat/errors";
import type { TingLabUIMessage } from "@/lib/chat/types";

import { AiComposer } from "./AiComposer";
import { AiMessage } from "./AiMessage";
import { useSharedChat } from "./chat-provider";
import { formatRagStatus, getMessageRagStatus, suggestedQuestions } from "./chat-ui";
import styles from "./AiChat.module.scss";

export type AiChatProps = Readonly<{
  mode: "compact" | "workspace";
  onSourceOpen?: (source: PublicRagSource) => void;
}>;

export function AiChat({ mode, onSourceOpen }: AiChatProps) {
  const chat = useSharedChat();
  const { messages, sendMessage, regenerate, stop, setMessages, status, error, clearError } =
    useChat<TingLabUIMessage>({ chat, experimental_throttle: 60 });
  const [input, setInput] = useState("");
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const submittingRef = useRef(false);
  const isGenerating = status === "submitted" || status === "streaming";
  const isStreaming = status === "streaming";
  const publicError = error ? parseClientChatError(error) : undefined;
  const latestRagStatus = [...messages].reverse().find((message) => message.role === "assistant");

  const scrollToBottom = useCallback((force = false) => {
    const container = scrollRef.current;
    if (!container || (!force && !nearBottomRef.current)) {
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    container.scrollTo({ top: container.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
    nearBottomRef.current = true;
    setIsNearBottom(true);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => scrollToBottom());
    return () => cancelAnimationFrame(frame);
  }, [messages, status, scrollToBottom]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, mode === "workspace" ? 200 : 128)}px`;
  }, [input, mode]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 56;
    nearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
  }

  // 提交锁：点击与 Enter 共用唯一入口，submittingRef 保证同一事件循环内
  // 双击或 Enter+点击只发一次；isGenerating 兜底防止流式期间重复提交。
  function submitQuestion(questionInput?: string) {
    const question = (questionInput ?? input).trim();
    if (!question || submittingRef.current || isGenerating) {
      return;
    }
    setInput("");
    clearError();
    nearBottomRef.current = true;
    submittingRef.current = true;
    void sendMessage({ text: question }).finally(() => {
      submittingRef.current = false;
    });
  }

  function clearConversation() {
    if (messages.length === 0 || window.confirm("清空当前对话？")) {
      void stop();
      setMessages([]);
      clearError();
      setInput("");
      submittingRef.current = false;
    }
  }

  function retry() {
    if (isGenerating) return;
    clearError();
    nearBottomRef.current = true;
    void regenerate();
  }

  const ragStatusLabel = formatRagStatus(
    latestRagStatus ? getMessageRagStatus(latestRagStatus) : undefined,
  );

  return (
    <div className={`${styles.chat} ${mode === "workspace" ? styles.workspace : styles.compact}`}>
      <div className={styles.toolbar}>
        <span className={styles.ragStatus}>{ragStatusLabel}</span>
        <div className={styles.toolbarActions}>
          {isGenerating ? (
            <button type="button" onClick={() => void stop()} aria-label="停止生成">
              停止
            </button>
          ) : null}
          <button
            type="button"
            onClick={clearConversation}
            disabled={messages.length === 0}
            aria-label="清空当前对话"
          >
            清空会话
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={styles.messages}
        onScroll={handleScroll}
        aria-live={isGenerating ? "off" : "polite"}
        aria-label="AI 对话记录"
      >
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            {mode === "workspace" ? (
              <>
                <p className={styles.eyebrow}>TING LAB / ASSISTANT</p>
                <h2 className={styles.emptyTitle}>问问 AI</h2>
                <p className={styles.emptyHint}>
                  可以聊前端、编程与软件工程。回答可能会引用本站已索引的博客文章，并附上可验证的来源链接。
                </p>
              </>
            ) : (
              <p className={styles.emptyHint}>从下面的问题开始，或直接输入你想了解的内容。</p>
            )}
            <div className={styles.suggestions}>
              {suggestedQuestions.map((question) => (
                <button key={question} type="button" onClick={() => submitQuestion(question)}>
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <AiMessage
              key={message.id}
              message={message}
              mode={mode}
              onSourceOpen={onSourceOpen}
              isStreaming={isStreaming && index === messages.length - 1}
            />
          ))
        )}

        {status === "submitted" ? <p className={styles.pending}>AI 正在思考…</p> : null}
        {publicError ? (
          <div className={styles.error} role="alert">
            <p>{publicError.message}</p>
            {publicError.retryable && messages.length > 0 ? (
              <button type="button" onClick={retry}>
                重试回答
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {!isNearBottom ? (
        <button className={styles.toBottom} type="button" onClick={() => scrollToBottom(true)}>
          回到底部 ↓
        </button>
      ) : null}

      <AiComposer
        mode={mode}
        value={input}
        disabled={!input.trim() || isGenerating}
        isGenerating={isGenerating}
        textareaRef={textareaRef}
        onChange={setInput}
        onSubmit={() => submitQuestion()}
        onStop={() => void stop()}
      />
    </div>
  );
}
