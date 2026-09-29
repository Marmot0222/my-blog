"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@ting-lab/ui";
import type { TagSummary } from "@ting-lab/content";
import styles from "./PostFilters.module.scss";

type Filter = { kind?: string; tag?: string };
function normalize(params: URLSearchParams): Filter {
  const kind = params.get("kind");
  return {
    kind: kind === "article" || kind === "note" ? kind : undefined,
    tag: params.get("tag") || undefined,
  };
}
export function PostFilters({ tags }: Readonly<{ tags: readonly TagSummary[] }>) {
  const router = useRouter();
  const params = useSearchParams();
  const current = normalize(new URLSearchParams(params.toString()));
  const desired = useRef<Filter>(current);
  const [pending, startTransition] = useTransition();
  // Only a completed navigation may replace the accumulated selection. During
  // a transition consecutive events merge into desired, never into stale props.
  useEffect(() => {
    if (!pending) desired.current = normalize(new URLSearchParams(params.toString()));
  }, [params, pending]);
  useEffect(() => {
    const restore = () => {
      desired.current = normalize(new URLSearchParams(window.location.search));
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function navigate(patch: Filter, reset = false) {
    const next = reset ? {} : { ...desired.current, ...patch };
    desired.current = next;
    const query = new URLSearchParams();
    if (next.kind) query.set("kind", next.kind);
    if (next.tag) query.set("tag", next.tag);
    startTransition(() =>
      router.push(query.size ? `/posts?${query}` : "/posts", { scroll: false }),
    );
  }
  const tagLabel = tags.find((tag) => tag.slug === current.tag)?.label;
  return (
    <div className={styles.filters} aria-busy={pending}>
      <RadioGroup
        aria-label="内容类型"
        value={current.kind ?? "all"}
        onValueChange={(kind) => navigate({ kind: kind === "all" ? undefined : kind })}
        orientation="horizontal"
      >
        <RadioGroupItem value="all">全部</RadioGroupItem>
        <RadioGroupItem value="article">文章</RadioGroupItem>
        <RadioGroupItem value="note">笔记</RadioGroupItem>
      </RadioGroup>
      <div className={styles.tag}>
        <Select
          value={current.tag ? `tag:${current.tag}` : "all"}
          onValueChange={(tag) => navigate({ tag: tag === "all" ? undefined : tag.slice(4) })}
        >
          <SelectTrigger
            aria-label="标签"
            title={tagLabel ?? (current.tag ? "未知标签" : "全部标签")}
          >
            <SelectValue placeholder="全部标签" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部标签</SelectItem>
            {current.tag && !tagLabel ? (
              <SelectItem value={`tag:${current.tag}`}>未知标签</SelectItem>
            ) : null}
            {tags.map((tag) => (
              <SelectItem key={tag.slug} value={`tag:${tag.slug}`} title={tag.label}>
                {tag.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {current.kind || current.tag ? (
        <button className={styles.reset} onClick={() => navigate({}, true)}>
          重置
        </button>
      ) : null}
      <span className={styles.pending} aria-live="polite">
        {pending ? "正在更新…" : ""}
      </span>
    </div>
  );
}
