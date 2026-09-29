"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { PostFrontMatter } from "@ting-lab/content";
import {
  Button,
  Input,
  Textarea,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@ting-lab/ui";
import styles from "./admin.module.scss";

export type EditorPost = {
  id: string;
  slug: string;
  version: number;
  metadata: PostFrontMatter;
  body: string;
  everPublished: boolean;
  publishedRevision: number | null;
  deleted: boolean;
  indexStatus?: string;
};
const initialMetadata: PostFrontMatter = {
  title: "",
  description: "",
  date: "",
  kind: "article",
  category: "",
  tags: [],
  featured: false,
  published: false,
};
export function PostEditor({ post }: { post?: EditorPost }) {
  const params = useSearchParams();
  const returnTarget = params.get("returnTo");
  const suffix =
    returnTarget && (returnTarget === "/admin/posts" || returnTarget.startsWith("/admin/posts?"))
      ? `?returnTo=${encodeURIComponent(returnTarget)}`
      : "";
  const router = useRouter(),
    [record, setRecord] = useState(post),
    [slug, setSlug] = useState(post?.slug ?? ""),
    [metadata, setMetadata] = useState(
      () =>
        post?.metadata ?? {
          ...initialMetadata,
          date: new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date()),
        },
    ),
    [body, setBody] = useState(post?.body ?? "");
  const [tags, setTags] = useState(post?.metadata.tags.join(", ") ?? "");
  const draft = {
      slug,
      metadata: {
        ...metadata,
        tags: [
          ...new Set(
            tags
              .split(/[,，]/)
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ],
      },
      body,
    },
    [saved, setSaved] = useState(JSON.stringify(draft)),
    dirty = JSON.stringify(draft) !== saved;
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [leaveHref, setLeaveHref] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState<"publish" | "unpublish" | "delete" | "restore" | null>(null);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const leave = (event: MouseEvent) => {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a[href]") : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const destination = new URL(anchor.href);
      if (
        destination.origin !== location.origin ||
        (destination.pathname === location.pathname && destination.search === location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveHref(destination.pathname + destination.search + destination.hash);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty]);
  const recordId = record?.id;
  const indexStatus = record?.indexStatus;
  useEffect(() => {
    if (!recordId || !["pending", "running"].includes(indexStatus ?? "")) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const refresh = async () => {
      try {
        const response = await fetch("/api/admin/posts/" + recordId, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return;
        const data: { indexStatus?: string } = await response.json();
        if (!controller.signal.aborted)
          setRecord((previous) =>
            previous ? { ...previous, indexStatus: data.indexStatus } : previous,
          );
        if (
          !controller.signal.aborted &&
          ++attempts < 5 &&
          ["pending", "running"].includes(data.indexStatus ?? "")
        )
          timer = setTimeout(refresh, 3000);
      } catch {
        /* Keep the last known status; a reload can retry. */
      }
    };
    timer = setTimeout(refresh, 3000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [recordId, indexStatus]);
  function field<K extends keyof PostFrontMatter>(key: K, value: PostFrontMatter[K]) {
    setMetadata((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(action: "save" | "publish" | "unpublish" | "delete" | "restore" | "retry") {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setFieldErrors({});
    let navigating = false;
    try {
      const response = await fetch(record ? `/api/admin/posts/${record.id}` : "/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          record
            ? { action, version: record.version, ...(action === "save" ? { draft } : {}) }
            : draft,
        ),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.message);
        setFieldErrors(data.fieldErrors ?? {});
        return;
      }
      if (action === "retry") {
        setRecord((previous) => (previous ? { ...previous, indexStatus: "pending" } : previous));
        setMessage("已请求重试索引，等待后台处理。");
        return;
      }
      if (!record) {
        setSaved(JSON.stringify(draft));
        router.replace(`/admin/posts/${data.id}/edit${suffix}`);
        navigating = true;
        return;
      }
      setRecord({
        id: data.id,
        slug: data.slug,
        version: data.version,
        metadata: data.metadata,
        body: data.body,
        everPublished: data.ever_published,
        publishedRevision: data.published_revision,
        deleted: !!data.deleted_at,
        indexStatus: data.index_status,
      });
      if (action === "save") {
        setSlug(data.slug);
        setMetadata(data.metadata);
        setBody(data.body);
        setTags(data.metadata.tags.join(", "));
        setSaved(JSON.stringify({ slug: data.slug, metadata: data.metadata, body: data.body }));
      }
      setMessage(
        action === "save"
          ? "草稿已保存，线上版本未改变。"
          : action === "publish"
            ? "已发布。索引将在后台处理。"
            : action === "restore"
              ? "已恢复为未发布内容。"
              : "操作完成，内容已从公开入口移除。",
      );
      setConfirm(null);
    } catch {
      setMessage("连接失败，输入已保留，请重试。");
    } finally {
      if (!navigating) setBusy(false);
    }
  }
  const labels = {
    publish: "发布",
    unpublish: "取消发布",
    delete: "移入回收站",
    restore: "恢复为草稿",
  };
  return (
    <>
      <h1>{record ? "编辑内容" : "新建草稿"}</h1>
      <p>
        {record?.publishedRevision ? "已发布 · 保存修改不会影响线上版本" : "未发布"} ·{" "}
        {busy ? "正在处理" : !record ? "尚未保存" : dirty ? "有未保存修改" : "已保存"} · 索引：
        {record?.indexStatus ?? "未入队"}
      </p>
      {Object.keys(fieldErrors).length > 0 && (
        <div role="alert" className={styles.notice}>
          <p>请检查以下字段：</p>
          {Object.entries(fieldErrors).map(([field, error]) => (
            <a
              key={field}
              href={`#editor-${field}`}
              onClick={() => document.getElementById(`editor-${field}`)?.focus()}
            >
              {field}：{error}{" "}
            </a>
          ))}
        </div>
      )}
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit("save");
        }}
      >
        <div className={styles.actions}>
          <Button disabled={busy || record?.deleted} type="submit">
            保存草稿
          </Button>
          {record && !dirty ? (
            <Button asChild variant="outline">
              <Link href={`/admin/posts/${record.id}/preview${suffix}`}>预览已保存草稿</Link>
            </Button>
          ) : null}
          {record ? (
            record.deleted ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirm("restore")}
              >
                恢复
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={busy || dirty}
                  onClick={() => setConfirm("publish")}
                >
                  发布
                </Button>
                {record.publishedRevision ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || dirty}
                    onClick={() => setConfirm("unpublish")}
                  >
                    取消发布
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy || dirty}
                  onClick={() => setConfirm("delete")}
                >
                  软删除
                </Button>
                {record.indexStatus === "failed" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void submit("retry")}
                  >
                    重试索引
                  </Button>
                ) : null}
              </>
            )
          ) : null}
        </div>
        <p role="status" className={message ? styles.notice : undefined}>
          {message}
        </p>
        <fieldset disabled={busy} className={styles.editorFields}>
          <Label>
            标题
            <Input
              required
              maxLength={200}
              id="editor-title"
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? "error-title" : undefined}
              value={metadata.title}
              onChange={(event) => field("title", event.target.value)}
            />
            {fieldErrors.title && <span id="error-title">{fieldErrors.title}</span>}
          </Label>
          <Label>
            描述
            <Textarea
              required
              maxLength={1000}
              id="editor-description"
              aria-invalid={!!fieldErrors.description}
              aria-describedby={fieldErrors.description ? "error-description" : undefined}
              value={metadata.description}
              onChange={(event) => field("description", event.target.value)}
            />
            {fieldErrors.description && (
              <span id="error-description">{fieldErrors.description}</span>
            )}
          </Label>
          <div className={styles.grid}>
            <Label>
              Slug
              <Input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={100}
                readOnly={record?.everPublished}
                id="editor-slug"
                aria-invalid={!!fieldErrors.slug}
                aria-describedby={fieldErrors.slug ? "error-slug" : undefined}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
              {fieldErrors.slug && <span id="error-slug">{fieldErrors.slug}</span>}
            </Label>
            <div>
              <Label htmlFor="editor-kind">类型</Label>
              <Select
                value={metadata.kind}
                onValueChange={(value) => field("kind", value === "note" ? "note" : "article")}
              >
                <SelectTrigger id="editor-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">文章</SelectItem>
                  <SelectItem value="note">笔记</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Label>
              分类
              <Input
                required
                maxLength={100}
                id="editor-category"
                aria-invalid={!!fieldErrors.category}
                aria-describedby={fieldErrors.category ? "error-category" : undefined}
                value={metadata.category}
                onChange={(event) => field("category", event.target.value)}
              />
              {fieldErrors.category && <span id="error-category">{fieldErrors.category}</span>}
            </Label>
            <Label>
              标签（逗号分隔）
              <Input
                required
                id="editor-tags"
                aria-invalid={!!fieldErrors.tags}
                aria-describedby={fieldErrors.tags ? "error-tags" : undefined}
                value={tags}
                onChange={(event) => setTags(event.target.value)}
              />
              {fieldErrors.tags && <span id="error-tags">{fieldErrors.tags}</span>}
            </Label>
            <Label>
              发布日期
              <Input
                type="date"
                required
                id="editor-date"
                aria-invalid={!!fieldErrors.date}
                aria-describedby={fieldErrors.date ? "error-date" : undefined}
                value={metadata.date}
                onChange={(event) => field("date", event.target.value)}
              />
              {fieldErrors.date && <span id="error-date">{fieldErrors.date}</span>}
            </Label>
            <Label>
              更新日期
              <Input
                type="date"
                value={metadata.updatedAt ?? ""}
                onChange={(event) => field("updatedAt", event.target.value || undefined)}
              />
            </Label>
            <Label>
              <span>
                <input
                  type="checkbox"
                  checked={metadata.featured}
                  onChange={(event) => field("featured", event.target.checked)}
                />{" "}
                精选内容
              </span>
            </Label>
            <div>
              <Label htmlFor="editor-visual">封面风格</Label>
              <Select
                value={metadata.visual ?? "none"}
                onValueChange={(value) =>
                  field(
                    "visual",
                    value === "interface" || value === "system" || value === "code"
                      ? value
                      : undefined,
                  )
                }
              >
                <SelectTrigger id="editor-visual">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  <SelectItem value="interface">界面</SelectItem>
                  <SelectItem value="system">系统</SelectItem>
                  <SelectItem value="code">代码</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Label>
            Markdown 正文
            <Textarea
              className={styles.bodyEditor}
              id="editor-body"
              aria-invalid={!!fieldErrors.body}
              aria-describedby={fieldErrors.body ? "error-body" : undefined}
              value={body}
              maxLength={200000}
              onChange={(event) => setBody(event.target.value)}
            />
            {fieldErrors.body && <span id="error-body">{fieldErrors.body}</span>}
          </Label>
          <p>
            支持 Markdown、代码块、表格。图片使用站内路径或 HTTPS 地址；不支持
            HTML、JSX、导入与表达式。
          </p>
        </fieldset>
        {(!record || dirty) && <p>发布前请先保存草稿。</p>}
      </form>
      <Dialog
        open={leaveHref !== null}
        onOpenChange={(open) => {
          if (!open) setLeaveHref(null);
        }}
      >
        <DialogContent>
          <DialogTitle>离开编辑？</DialogTitle>
          <DialogDescription>有未保存的修改，离开后这些输入将丢失。</DialogDescription>
          <Button
            onClick={() => {
              if (leaveHref) router.push(leaveHref);
              setLeaveHref(null);
            }}
          >
            确认离开
          </Button>
          <Button variant="outline" onClick={() => setLeaveHref(null)}>
            继续编辑
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{confirm ? labels[confirm] : "确认操作"}</DialogTitle>
          <DialogDescription>
            {confirm === "publish"
              ? "将已保存的草稿设为公开版本，访客随后即可阅读。"
              : "此操作会改变内容的公开状态。恢复不会自动重新发布。"}
          </DialogDescription>
          <div className={styles.actions}>
            <Button
              disabled={busy}
              onClick={() => {
                if (confirm) void submit(confirm);
              }}
            >
              确认{confirm ? labels[confirm] : ""}
            </Button>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              返回编辑
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
