"use client";

import { postKindLabels } from "@ting-lab/content/kinds";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle } from "@ting-lab/ui";

import { formatFullDate } from "@/lib/format-date";

import type { DrawerPost } from "./AiWorkspace";
import styles from "./ArticleDrawer.module.scss";

type ArticleDrawerProps = Readonly<{
  open: boolean;
  post?: DrawerPost;
  status: "ok" | "not_found";
  onClose(): void;
}>;

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
        {post.tagLinks.map(({ tag, slug }) => (
          <li key={tag}>
            <Link href={`/tags/${slug}`}># {tag}</Link>
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
    <div ref={bodyRef} data-scroll-area className={styles.body}>
      {post.content}
    </div>
  );
}

export function ArticleDrawer({ open, post, status, onClose }: ArticleDrawerProps) {
  // Retain only the already-rendered panel during Radix's exit presence. An open
  // not-found response always takes precedence over any previous public content.
  const [retained, setRetained] = useState(post);
  useEffect(() => {
    if (open) setRetained(post);
  }, [open, post]);
  const shown = open ? post : retained;
  const found = shown && (!open || status === "ok");
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent
        hideClose
        motion="right"
        className={styles.dialog}
        aria-describedby={undefined}
        onCloseAutoFocus={() => setRetained(undefined)}
      >
        <header className={styles.dialogHeader}>
          <div>
            {found ? (
              <p className={styles.eyebrow}>
                {postKindLabels[shown.metadata.kind]} / {shown.metadata.category}
              </p>
            ) : null}
            <DialogTitle className={styles.title}>
              {found ? shown.metadata.title : "文章未找到"}
            </DialogTitle>
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
        {found ? (
          <>
            <ArticleMeta post={shown} />
            <DrawerContent post={shown} />
            <footer className={styles.dialogFooter}>
              <Link href={`/posts/${shown.slug}`} className={styles.primaryAction}>
                在完整文章页打开
              </Link>
            </footer>
          </>
        ) : (
          <div className={styles.body}>
            <p className={styles.notFoundText}>
              该文章不存在或尚未发布，可能链接已失效。可以关闭抽屉继续对话。
            </p>
            <button type="button" className={styles.primaryAction} onClick={onClose}>
              关闭抽屉
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
