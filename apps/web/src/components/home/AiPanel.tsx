import { AiChat } from "@/components/ai/AiChat";

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
          按需连接
          <ExpandIcon />
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>TING LAB / ASSISTANT</p>
          <h2 id="ai-panel-title">问问 AI</h2>
          <p>可以先聊前端、编程与软件工程。博客知识检索将在下一阶段接入。</p>
        </div>
        <AiChat />
      </div>
    </aside>
  );
}
