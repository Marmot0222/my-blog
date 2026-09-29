"use client";

import type { SearchResult } from "@ting-lab/content";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@ting-lab/ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";

import styles from "./SearchDialog.module.scss";

type SearchResponse = Readonly<{ query: string; results: SearchResult[] }>;

function Highlight({ text, query }: Readonly<{ text: string; query: string }>) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return text;
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const matcher = new RegExp(`(${escaped.join("|")})`, "giu");
  const normalizedTerms = new Set(terms.map((term) => term.toLocaleLowerCase("zh-CN")));
  return text.split(matcher).map((part, index) =>
    normalizedTerms.has(part.toLocaleLowerCase("zh-CN")) ? (
      <mark className={styles.highlight} key={`${part}-${index}`}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

type SearchDialogProps = Readonly<{
  open: boolean;
  onClose(): void;
  returnFocusRef: RefObject<HTMLElement | null>;
}>;

export function SearchDialog({ open, onClose, returnFocusRef }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [retry, setRetry] = useState(0);
  const listId = useId();
  const requestId = useRef(0);

  const runSearch = useCallback(async (value: string, signal: AbortSignal) => {
    const currentRequest = ++requestId.current;
    setStatus("loading");
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal });
      if (!response.ok) throw new Error("search_failed");
      const data = (await response.json()) as SearchResponse;
      if (signal.aborted || currentRequest !== requestId.current) return;
      setResults(data.results);
      setActiveIndex(0);
      setStatus("ready");
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      if (currentRequest === requestId.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setResults([]);
    const value = query.trim();
    if (!value) {
      requestId.current += 1;
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => void runSearch(value, controller.signal), 200);
    return () => {
      window.clearTimeout(timeout);
      requestId.current += 1;
      controller.abort();
    };
  }, [open, query, runSearch, retry]);

  useEffect(() => {
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || status !== "ready") return;
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      onClose();
      router.push(results[activeIndex].href);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        hideClose
        className={styles.dialog}
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <DialogTitle className={styles.srOnly}>搜索 Ting Lab</DialogTitle>
        <div className={styles.header}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            className={styles.input}
            ref={inputRef}
            value={query}
            maxLength={120}
            placeholder="搜索文章、项目与话题…"
            aria-label="搜索内容"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={results.length > 0}
            aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            onKeyDown={handleKeyDown}
            onChange={(event) => {
              requestId.current += 1;
              setResults([]);
              setStatus(event.target.value.trim() ? "loading" : "idle");
              setQuery(event.target.value);
            }}
          />
          <button className={styles.close} type="button" aria-label="关闭搜索" onClick={onClose}>
            <svg className={styles.closeIcon} viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.content} aria-live="polite" aria-busy={status === "loading"}>
          {status === "idle" ? <div className={styles.state}>输入关键词开始搜索</div> : null}
          {status === "loading" ? <div className={styles.state}>正在搜索…</div> : null}
          {status === "error" ? (
            <div className={styles.state}>
              <div>
                搜索暂时不可用。
                <br />
                <button type="button" onClick={() => setRetry((value) => value + 1)}>
                  重试
                </button>
              </div>
            </div>
          ) : null}
          {status === "ready" && results.length === 0 ? (
            <div className={styles.state}>没有找到相关内容，试试更短的关键词。</div>
          ) : null}
          {results.length > 0 ? (
            <ul className={styles.results} id={listId} role="listbox">
              {results.map((result, index) => (
                <li
                  key={result.id}
                  role="option"
                  id={`${listId}-${index}`}
                  aria-selected={index === activeIndex}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    className={styles.result}
                    data-active={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => {
                      onClose();
                      router.push(result.href);
                    }}
                  >
                    <span className={styles.resultMeta}>
                      <span>
                        {result.type === "project"
                          ? "项目"
                          : result.kind === "article"
                            ? "文章"
                            : "笔记"}
                      </span>
                      <time dateTime={result.date}>{result.date}</time>
                    </span>
                    <span className={styles.resultTitle}>
                      <Highlight text={result.title} query={query} />
                    </span>
                    <span className={styles.resultExcerpt}>
                      <Highlight text={result.description || result.excerpt} query={query} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className={styles.footer}>↑↓ 选择 · Enter 打开 · Esc 关闭</div>
      </DialogContent>
    </Dialog>
  );
}
