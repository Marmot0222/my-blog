"use client";

import type { SearchResult } from "@ting-lab/content";
import Link from "next/link";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const requestId = useRef(0);

  const runSearch = useCallback(async (value: string, signal: AbortSignal) => {
    const currentRequest = ++requestId.current;
    setStatus("loading");
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal });
      if (!response.ok) throw new Error("search_failed");
      const data = (await response.json()) as SearchResponse;
      if (currentRequest !== requestId.current) return;
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
    const returnFocus = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus();
    };
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const value = query.trim();
    if (!value) {
      requestId.current += 1;
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => void runSearch(value, controller.signal), 200);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, runSearch]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + results.length) % results.length);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      window.location.assign(results[activeIndex].href);
    } else if (event.key === "Tab") {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="搜索 Ting Lab"
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
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
            placeholder="搜索文章、笔记与话题…"
            aria-label="搜索内容"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={results.length > 0}
            aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            onChange={(event) => setQuery(event.target.value)}
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
                <button
                  type="button"
                  onClick={() => void runSearch(query.trim(), new AbortController().signal)}
                >
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
                <li key={result.id} role="option" aria-selected={index === activeIndex}>
                  <Link
                    className={styles.result}
                    id={`${listId}-${index}`}
                    href={result.href}
                    data-active={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={onClose}
                  >
                    <span className={styles.resultMeta}>
                      <span>{result.kind === "article" ? "文章" : "笔记"}</span>
                      <time dateTime={result.date}>{result.date}</time>
                    </span>
                    <span className={styles.resultTitle}>
                      <Highlight text={result.title} query={query} />
                    </span>
                    <span className={styles.resultExcerpt}>
                      <Highlight text={result.description || result.excerpt} query={query} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className={styles.footer}>↑↓ 选择 · Enter 打开 · Esc 关闭</div>
      </div>
    </div>
  );
}
