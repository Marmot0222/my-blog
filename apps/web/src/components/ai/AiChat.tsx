"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { parseClientChatError } from "@/lib/chat/errors";

import { AiComposer } from "./AiComposer";
import styles from "./AiChat.module.scss";
import { AiMessage } from "./AiMessage";
import { suggestedQuestions } from "./chat-ui";

export function AiChat() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, regenerate, stop, setMessages, status, error, clearError } =
    useChat({ transport, experimental_throttle: 60 });
  const [input, setInput] = useState("");
  const [isNearBottom, setIsNearBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const isGenerating = status === "submitted" || status === "streaming";
  const publicError = error ? parseClientChatError(error) : undefined;

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
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [input]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 56;
    nearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);
  }

  function submitQuestion() {
    const question = input.trim();
    if (!question || isGenerating) return;
    setInput("");
    clearError();
    nearBottomRef.current = true;
    void sendMessage({ text: question });
  }

  function clearConversation() {
    if (messages.length === 0 || window.confirm("清空当前对话？")) {
      void stop();
      setMessages([]);
      clearError();
      setInput("");
    }
  }

  function retry() {
    clearError();
    nearBottomRef.current = true;
    void regenerate();
  }

  return (
    <div className={styles.chat}>
      <div className={styles.toolbar}>
        <span>暂未接入博客知识库</span>
        <button type="button" onClick={clearConversation} disabled={messages.length === 0}>
          清空会话
        </button>
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
            <p>可以从这些问题开始：</p>
            <div className={styles.suggestions}>
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => {
                    setInput(question);
                    textareaRef.current?.focus();
                  }}
                >
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
              isStreaming={isGenerating && index === messages.length - 1}
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
        value={input}
        disabled={!input.trim() || isGenerating}
        isGenerating={isGenerating}
        textareaRef={textareaRef}
        onChange={setInput}
        onSubmit={submitQuestion}
        onStop={() => void stop()}
      />
    </div>
  );
}
