import { AiComposer } from "@/components/ai/AiComposer";

import styles from "./AiPanel.module.scss";

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
    </svg>
  );
}

export function AiPanel() {
  return (
    <aside className={styles.panel} id="ai" aria-labelledby="ai-panel-title">
      <div className={styles.panelHeader}>
        <strong>AI 问答</strong>
        <div className={styles.status}>
          <span aria-hidden="true" />
          在线
          <ExpandIcon />
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>TING LAB / KNOWLEDGE</p>
          <h2 id="ai-panel-title">问问我的博客</h2>
          <p>基于本站内容，回答你的技术问题</p>
        </div>

        <div className={styles.conversation} aria-label="AI 问答示例">
          <div className={styles.userMessage}>
            <p>Next.js 15 的并发渲染是什么？</p>
            <time>10:24 ✓</time>
          </div>

          <div className={styles.answerRow}>
            <span className={styles.avatar} aria-hidden="true">
              T
            </span>
            <div className={styles.aiMessage}>
              <p>
                并发渲染让 React
                可以暂停、恢复或放弃一次渲染，把紧急交互放在更高优先级处理，从而让页面在复杂更新中依然保持响应。
              </p>
              <time>10:24</time>
            </div>
          </div>
        </div>

        <AiComposer />
      </div>
    </aside>
  );
}
