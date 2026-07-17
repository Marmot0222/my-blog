"use client";

import { tagToSlug } from "@ting-lab/content";
import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";

import { formatFullDate } from "@/lib/format-date";

import type { DrawerPost } from "./AiWorkspace";
import styles from "./ArticleDrawer.module.scss";

type ArticleDrawerProps = Readonly<{
  post?: DrawerPost;
  status: "ok" | "not_found";
  onClose(): void;
}>;

const FOCUSABLE_SELECTOR =
  'a[href], button:not(:disabled), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function ArticleMeta({ post }: Readonly<{ post: DrawerPost }>) {
  const { metadata } = post;
  return (
    <div className={styles.meta}>
      <time dateTime={metadata.date}>发布于 {formatFullDate(metadata.date)}</time>
      {metadata.updatedAt ? (
        <time dateTime={metadata.updatedAt}>更新于 {formatFullDate(metadata.updatedAt)}</time>
      ) : null}
      <span>{metadata.readingTime}</span>
      <ul className={styles.tags} aria-label="文章标签">
        {metadata.tags.map((tag) => (
          <li key={tag}>
            <Link href={`/tags/${tagToSlug(tag)}`}># {tag}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DrawerContent({ post }: Readonly<{ post: DrawerPost }>) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    let decoded = hash;
    try {
      decoded = decodeURIComponent(hash);
    } catch {
      // 保留原始 hash。
    }
    const container = bodyRef.current;
    if (!container) return;
    const target =
      (container.querySelector(`#${CSS.escape(decoded)}`) as HTMLElement | null) ??
      (document.getElementById(decoded) as HTMLElement | null) ??
      (document.getElementById(hash) as HTMLElement | null);
    if (!target) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    target.classList.add(styles.anchorHighlight);
    const timer = window.setTimeout(() => {
      target.classList.remove(styles.anchorHighlight);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [post]);

  return (
    <div ref={bodyRef} className={styles.body}>
      {post.content}
    </div>
  );
}

export function ArticleDrawer({ post, status, onClose }: ArticleDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog) {
      const focusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable ?? dialog).focus();
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const container = dialogRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => {
        if (el.hasAttribute("disabled")) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  function handleOverlayClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  if (status === "not_found" || !post) {
    return (
      <div className={styles.overlay} onClick={handleOverlayClick}>
        <div
          ref={dialogRef}
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-notfound-title"
          tabIndex={-1}
        >
          <header className={styles.dialogHeader}>
            <h2 id="drawer-notfound-title" className={styles.title}>
              文章未找到
            </h2>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
              aria-label="关闭抽屉"
            >
              关闭
            </button>
          </header>
          <div className={styles.body}>
            <p className={styles.notFoundText}>
              该文章不存在或尚未发布，可能链接已失效。可以关闭抽屉继续对话。
            </p>
            <button type="button" className={styles.primaryAction} onClick={onClose}>
              关闭抽屉
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
      >
        <header className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>
              {post.metadata.kind === "article" ? "Article" : "Note"} / {post.metadata.category}
            </p>
            <h2 id="drawer-title" className={styles.title}>
              {post.metadata.title}
            </h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="关闭抽屉"
          >
            关闭
          </button>
        </header>

        <ArticleMeta post={post} />

        <DrawerContent post={post} />

        <footer className={styles.dialogFooter}>
          <Link href={`/posts/${post.slug}`} className={styles.primaryAction}>
            在完整文章页打开
          </Link>
        </footer>
      </div>
    </div>
  );
}
