"use client";

import type { FormEvent } from "react";

import styles from "./AiComposer.module.scss";

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 3-7.5 18-3.2-7.3L3 10.5 21 3Z" />
      <path d="m10.3 13.7 4.2-4.2" />
    </svg>
  );
}

export function AiComposer() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} aria-label="AI 问答演示表单">
      <div className={styles.inputWrap}>
        <label className={styles.srOnly} htmlFor="ai-question">
          输入问题
        </label>
        <input
          id="ai-question"
          name="question"
          type="text"
          placeholder="开始提问…"
          autoComplete="off"
        />
        <button type="submit" aria-label="发送问题">
          <SendIcon />
        </button>
      </div>
      <button className={styles.primaryButton} type="submit">
        开始提问
      </button>
      <p className={styles.hint}>静态交互演示 · 不会发送网络请求</p>
    </form>
  );
}
