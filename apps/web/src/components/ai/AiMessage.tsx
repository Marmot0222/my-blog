import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { TingLabUIMessage } from "@/lib/chat/types";

import { getMessageSources, getMessageText } from "./chat-ui";
import styles from "./AiChat.module.scss";

type AiMessageProps = Readonly<{
  message: TingLabUIMessage;
  isStreaming: boolean;
}>;

export function AiMessage({ message, isStreaming }: AiMessageProps) {
  const text = getMessageText(message);
  const sources = getMessageSources(message);

  if (message.role === "user") {
    return <div className={styles.userMessage}>{text}</div>;
  }

  return (
    <div className={styles.answerRow}>
      <span className={styles.avatar} aria-hidden="true">
        T
      </span>
      <div className={styles.answerContent}>
        <div className={styles.aiMessage}>
          {text ? (
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
          ) : (
            <p className={styles.loadingText}>{isStreaming ? "正在回答…" : "回答已停止。"}</p>
          )}
        </div>
        {sources.length > 0 ? (
          <div className={styles.sources} aria-label="博客参考来源">
            <strong>参考来源</strong>
            <ol>
              {sources.map((source) => (
                <li key={source.id}>
                  <Link href={source.url}>
                    <span>{source.index}</span>
                    <span>
                      {source.title}
                      {source.heading ? <small>{source.heading}</small> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}
