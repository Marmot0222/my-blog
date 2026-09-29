"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  date: new Date().toISOString().slice(0, 10),
  kind: "article",
  category: "",
  tags: [],
  featured: false,
  published: false,
};
export function PostEditor({ post }: { post?: EditorPost }) {
  const router = useRouter(),
    [record, setRecord] = useState(post),
    [slug, setSlug] = useState(post?.slug ?? ""),
    [metadata, setMetadata] = useState(post?.metadata ?? initialMetadata),
    [body, setBody] = useState(post?.body ?? "");
  const draft = { slug, metadata, body },
    [saved, setSaved] = useState(JSON.stringify(draft)),
    dirty = JSON.stringify(draft) !== saved;
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
      if (
        target instanceof Element &&
        target.closest("a[href]") &&
        !window.confirm("有未保存的修改，确定离开？")
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [dirty]);
  function field<K extends keyof PostFrontMatter>(key: K, value: PostFrontMatter[K]) {
    setMetadata((previous) => ({ ...previous, [key]: value }));
  }
  async function submit(action: "save" | "publish" | "unpublish" | "delete" | "restore" | "retry") {
    setBusy(true);
    setMessage("");
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
        return;
      }
      if (action === "retry") {
        setMessage("已请求重试索引。");
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
      if (action === "save") setSaved(JSON.stringify(draft));
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
      if (!record) router.replace(`/admin/posts/${data.id}/edit`);
      router.refresh();
    } catch {
      setMessage("连接失败，输入已保留，请重试。");
    } finally {
      setBusy(false);
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
        {dirty ? "有未保存修改" : "已保存"} · 索引：{record?.indexStatus ?? "未入队"}
      </p>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void submit("save");
        }}
      >
        <Label>
          标题
          <Input
            required
            maxLength={200}
            value={metadata.title}
            onChange={(event) => field("title", event.target.value)}
          />
        </Label>
        <Label>
          描述
          <Textarea
            required
            maxLength={1000}
            value={metadata.description}
            onChange={(event) => field("description", event.target.value)}
          />
        </Label>
        <div className={styles.grid}>
          <Label>
            Slug
            <Input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              maxLength={100}
              readOnly={record?.everPublished}
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
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
              value={metadata.category}
              onChange={(event) => field("category", event.target.value)}
            />
          </Label>
          <Label>
            标签（逗号分隔）
            <Input
              required
              value={metadata.tags.join(",")}
              onChange={(event) => field("tags", event.target.value.split(/[,，]/))}
            />
          </Label>
          <Label>
            发布日期
            <Input
              type="date"
              required
              value={metadata.date}
              onChange={(event) => field("date", event.target.value)}
            />
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
            value={body}
            maxLength={200000}
            onChange={(event) => setBody(event.target.value)}
          />
        </Label>
        <p>
          支持 Markdown、代码块、表格。图片使用站内路径或 HTTPS 地址；不支持
          HTML、JSX、导入与表达式。
        </p>
        <div className={styles.actions}>
          <Button disabled={busy || record?.deleted} type="submit">
            保存草稿
          </Button>
          {record && !dirty ? (
            <Button asChild variant="outline">
              <Link href={`/admin/posts/${record.id}/preview`}>预览已保存草稿</Link>
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
      </form>
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
