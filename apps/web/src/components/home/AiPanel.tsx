"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AiChat } from "@/components/ai/AiChat";

import styles from "./AiPanel.module.scss";

const COLLAPSED_STORAGE_KEY = "tinglab:ai-panel-collapsed";

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
    </svg>
  );
}

export function AiPanel() {
  // SSR 与首次客户端渲染均输出展开态，挂载后再从 localStorage 同步偏好，
  // 避免 hydration mismatch。
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true") {
        setCollapsed(true);
      }
    } catch {
      // localStorage 不可用时静默回退到展开态。
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // 忽略写入失败。
      }
      return next;
    });
  }

  return (
    <aside
      className={`${styles.container} ${collapsed ? styles.collapsed : ""}`}
      data-ai-collapsed={collapsed ? "true" : "false"}
      id="ai"
      aria-labelledby="ai-panel-title"
    >
      {/* 完整面板：折叠时通过 CSS 隐藏而非卸载，AiChat 保持挂载以保留生成状态。 */}
      <div className={styles.panel} aria-hidden={collapsed || undefined}>
        <div className={styles.panelHeader}>
          <strong id="ai-panel-title">AI 问答</strong>
          <div className={styles.headerActions}>
            <Link href="/ai" className={styles.fullLink} aria-label="进入完整 AI 页面">
              <ExternalIcon />
              <span>完整页面</span>
            </Link>
            <button
              type="button"
              className={styles.collapseButton}
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-controls="ai"
              aria-label="收起 AI 问答面板"
            >
              <CollapseIcon />
              <span>收起</span>
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>TING LAB / ASSISTANT</p>
            <h2 className={styles.introTitle}>问问 AI</h2>
            <p className={styles.introText}>
              可以聊前端、编程与软件工程；已索引的博客内容会附带可靠来源。
            </p>
          </div>
          <AiChat mode="compact" />
        </div>
      </div>

      {/* 窄 rail：桌面折叠态显示，保留入口与展开操作。 */}
      <div className={styles.rail} aria-hidden={!collapsed || undefined}>
        <button
          type="button"
          className={styles.railButton}
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="ai"
          aria-label="展开 AI 问答面板"
        >
          <span className={styles.railMark} aria-hidden="true">
            AI
          </span>
          <ExpandIcon />
        </button>
      </div>

      {/* 移动端折叠入口：mounted 后才交互，避免 SSR 不一致。 */}
      {mounted && collapsed ? (
        <button
          type="button"
          className={styles.mobileEntry}
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-controls="ai"
          aria-label="展开 AI 问答面板"
        >
          展开问问 AI
          <ExpandIcon />
        </button>
      ) : null}
    </aside>
  );
}
