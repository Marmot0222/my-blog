"use client";

import type { PublicRagSource } from "@ting-lab/retrieval";
import Link from "next/link";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { TingLabUIMessage } from "@/lib/chat/types";

import { getMessageSources, getMessageText } from "./chat-ui";
import styles from "./AiChat.module.scss";

type AiMessageProps = Readonly<{
  message: TingLabUIMessage;
  mode: "compact" | "workspace";
  isStreaming: boolean;
  onSourceOpen?: (source: PublicRagSource) => void;
}>;

function dedupeSources(sources: readonly PublicRagSource[]): PublicRagSource[] {
  const seen = new Set<string>();
  const result: PublicRagSource[] = [];
  for (const source of sources) {
    if (seen.has(source.url)) continue;
    seen.add(source.url);
    result.push(source);
  }
  return result;
}

function Sources({
  sources,
  onSourceOpen,
}: Readonly<{
  sources: PublicRagSource[];
  onSourceOpen?: (source: PublicRagSource) => void;
}>) {
  if (sources.length === 0) return null;
  return (
    <div className={styles.sources} aria-label="博客参考来源">
      <strong>关联文章</strong>
      <ol>
        {sources.map((source) => {
          const label = source.heading ? `${source.title} · ${source.heading}` : source.title;
          if (onSourceOpen) {
            return (
              <li key={source.id}>
                <a
                  href={source.url}
                  onClick={(event) => {
                    event.preventDefault();
                    onSourceOpen(source);
                  }}
                >
                  <span className={styles.sourceIndex} aria-hidden="true">
                    {source.index}
                  </span>
                  <span className={styles.sourceLabel}>{label}</span>
                </a>
              </li>
            );
          }
          return (
            <li key={source.id}>
              <Link href={source.url}>
                <span className={styles.sourceIndex} aria-hidden="true">
                  {source.index}
                </span>
                <span className={styles.sourceLabel}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CopyButton({ text }: Readonly<{ text: string }>) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!text || typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      className={styles.copyButton}
      onClick={handleCopy}
      aria-label={copied ? "已复制" : "复制回答"}
    >
      {copied ? "已复制" : "复制"}
    </button>
  );
}

export function AiMessage({ message, mode, isStreaming, onSourceOpen }: AiMessageProps) {
  const text = getMessageText(message);
  const sources = dedupeSources(getMessageSources(message));

  if (message.role === "user") {
    return (
      <div className={`${styles.userMessage} ${mode === "workspace" ? styles.userWorkspace : ""}`}>
        {text}
      </div>
    );
  }

  // 空文本处理：避免幽灵气泡。
  if (!text) {
    // 正在流式输出但尚无文本：轻量状态行，不渲染气泡。
    if (isStreaming) {
      return (
        <div className={styles.statusRow} role="status">
          <span className={styles.statusDot} aria-hidden="true" />
          正在回答…
        </div>
      );
    }
    // 非流式且无文本：若有来源则只渲染紧凑来源区，否则不渲染该消息。
    if (sources.length > 0) {
      return (
        <div className={styles.answerRow}>
          <span className={styles.avatar} aria-hidden="true">
            T
          </span>
          <div className={styles.answerContent}>
            <Sources sources={sources} onSourceOpen={onSourceOpen} />
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={styles.answerRow}>
      <span className={styles.avatar} aria-hidden="true">
        T
      </span>
      <div className={styles.answerContent}>
        <div className={styles.aiMessage}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                const external = typeof href === "string" && /^https?:\/\//.test(href);
                return (
                  <a
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {text}
          </ReactMarkdown>
          <div className={styles.answerFooter}>
            <CopyButton text={text} />
          </div>
        </div>
        <Sources sources={sources} onSourceOpen={onSourceOpen} />
      </div>
    </div>
  );
}
