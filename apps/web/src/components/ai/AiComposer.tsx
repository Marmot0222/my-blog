import type { FormEvent, KeyboardEvent, RefObject } from "react";

import styles from "./AiComposer.module.scss";

type AiComposerProps = Readonly<{
  mode: "compact" | "workspace";
  value: string;
  disabled: boolean;
  isGenerating: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange(value: string): void;
  onSubmit(): void;
  onStop(): void;
}>;

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 3-7.5 18-3.2-7.3L3 10.5 21 3Z" />
      <path d="m10.3 13.7 4.2-4.2" />
    </svg>
  );
}

export function AiComposer({
  mode,
  value,
  disabled,
  isGenerating,
  textareaRef,
  onChange,
  onSubmit,
  onStop,
}: AiComposerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <form
      className={`${styles.form} ${mode === "workspace" ? styles.workspace : styles.compact}`}
      onSubmit={handleSubmit}
      aria-label="AI 对话输入"
    >
      <div className={styles.inputWrap}>
        <label className={styles.srOnly} htmlFor="ai-question">
          输入问题
        </label>
        <textarea
          ref={textareaRef}
          id="ai-question"
          name="question"
          rows={1}
          value={value}
          maxLength={4000}
          placeholder="开始提问…"
          autoComplete="off"
          disabled={isGenerating}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {isGenerating ? (
          <button
            className={styles.stopButton}
            type="button"
            onClick={onStop}
            aria-label="停止生成"
          >
            <span aria-hidden="true" />
          </button>
        ) : (
          <button
            className={styles.sendButton}
            type="submit"
            disabled={disabled}
            aria-label="发送问题"
          >
            <SendIcon />
          </button>
        )}
      </div>
      <div className={styles.footerRow}>
        <span>Enter 发送 · Shift+Enter 换行</span>
        <span className={value.length > 3600 ? styles.nearLimit : undefined}>
          {value.length}/4000
        </span>
      </div>
    </form>
  );
}
