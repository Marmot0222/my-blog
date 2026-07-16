import type { UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getMessageText } from "./chat-ui";
import styles from "./AiChat.module.scss";

type AiMessageProps = Readonly<{
  message: UIMessage;
  isStreaming: boolean;
}>;

export function AiMessage({ message, isStreaming }: AiMessageProps) {
  const text = getMessageText(message);

  if (message.role === "user") {
    return <div className={styles.userMessage}>{text}</div>;
  }

  return (
    <div className={styles.answerRow}>
      <span className={styles.avatar} aria-hidden="true">
        T
      </span>
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
    </div>
  );
}
