"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Button, Textarea, Input, Label, Dialog, DialogContent, DialogTitle } from "@ting-lab/ui";
import { previewDraft } from "@/lib/admin/preview";
import { ReadingContent } from "@/components/mdx/ReadingContent";
import { MediaLibrary } from "./MediaLibrary";
import { uploadMarker, imageMarkdown, draftWithoutUploads } from "./upload-state";
import styles from "./MarkdownEditor.module.scss";

type Upload = {
  id: string;
  file: File;
  alt: string;
  status: "queued" | "uploading" | "failed";
  error?: string;
  controller?: AbortController;
};
type Props = {
  body: string;
  setBody: Dispatch<SetStateAction<string>>;
  metadata: { title: string; description: string; category: string; date: string };
  onPending: (pending: boolean) => void;
};
export function MarkdownEditor({ body, setBody, metadata, onPending }: Props) {
  const textarea = useRef<HTMLTextAreaElement>(null),
    picker = useRef<HTMLInputElement>(null);
  const queue = useRef<Upload[]>([]),
    alive = useRef(true),
    composing = useRef(false),
    uploadSession = useRef("");
  const [, redraw] = useState(0),
    [notice, setNotice] = useState("");
  const [mode, setMode] = useState("edit"),
    [library, setLibrary] = useState(false);
  const [preview, setPreview] = useState<ReactNode>(null),
    [previewError, setPreviewError] = useState(""),
    [pending, setPending] = useState(false),
    [refresh, setRefresh] = useState(0);
  const sequence = useRef(0);
  function updateQueue() {
    if (alive.current) {
      redraw((v) => v + 1);
      onPending(queue.current.length > 0);
    }
  }
  useEffect(() => {
    alive.current = true;
    uploadSession.current = crypto.randomUUID();
    return () => {
      alive.current = false;
      queue.current.forEach((item) => item.controller?.abort());
      queue.current = [];
    };
  }, []);
  const title = metadata.title,
    description = metadata.description,
    category = metadata.category,
    date = metadata.date;
  useEffect(() => {
    if (mode === "edit") return;
    const controller = new AbortController(),
      ticket = ++sequence.current;
    setPending(true);
    setPreviewError("");
    const timer = setTimeout(() => {
      void previewDraft({ title, description, category, date, body: draftWithoutUploads(body) })
        .then((result) => {
          if (controller.signal.aborted || ticket !== sequence.current) return;
          if (result.error) setPreviewError(result.error);
          else setPreview(result.content);
          setPending(false);
        })
        .catch(() => {
          if (!controller.signal.aborted && ticket === sequence.current) {
            setPreviewError("预览连接失败，请重试");
            setPending(false);
          }
        });
    }, 700);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body, title, description, category, date, mode, refresh]);
  // Use native editing transactions so toolbar/upload replacements enter the browser undo stack.
  function insert(text: string, start?: number, end?: number) {
    const element = textarea.current;
    if (!element) return;
    const from = start ?? element.selectionStart,
      to = end ?? element.selectionEnd;
    element.focus({ preventScroll: true });
    element.setSelectionRange(from, to);
    if (!document.execCommand("insertText", false, text)) {
      element.setRangeText(text, from, to, "end");
      setBody(element.value);
    }
  }
  function cancel(id: string) {
    const item = queue.current.find((item) => item.id === id);
    item?.controller?.abort();
    queue.current = queue.current.filter((item) => item.id !== id);
    const element = textarea.current,
      marker = uploadMarker(id),
      start = element?.value.indexOf(marker) ?? -1;
    if (element && start >= 0) insert("", start, start + marker.length);
    updateQueue();
  }
  async function pump() {
    if (queue.current.some((item) => item.status === "uploading") || !alive.current) return;
    const item = queue.current.find((item) => item.status === "queued");
    if (!item) return;
    item.status = "uploading";
    item.controller = new AbortController();
    const timeout = setTimeout(() => item.controller?.abort(), 40000);
    updateQueue();
    try {
      const response = await fetch("/api/admin/media", {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-upload-session": uploadSession.current,
          "x-filename": encodeURIComponent(item.file.name),
        },
        body: item.file,
        signal: item.controller.signal,
      });
      const data = await response.json().catch(() => ({
        message: response.status === 413 ? "图片超过上传大小限制" : "上传服务响应无效，请重试",
      }));
      if (!response.ok) throw new Error(data.message ?? "上传失败");
      if (
        typeof data.id !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(data.id)
      )
        throw new Error("上传服务响应无效，请重试");
      while (composing.current && alive.current && !item.controller.signal.aborted)
        await new Promise((resolve) => setTimeout(resolve, 50));
      if (!alive.current || item.controller.signal.aborted || !queue.current.includes(item)) return;
      const element = textarea.current,
        marker = uploadMarker(item.id),
        start = element?.value.indexOf(marker) ?? -1;
      if (element && start >= 0 && element.value.indexOf(marker, start + marker.length) < 0) {
        const oldStart = element.selectionStart,
          oldEnd = element.selectionEnd,
          previousFocus = document.activeElement;
        const replacement = imageMarkdown(`/media/${data.id}`, item.alt);
        insert(replacement, start, start + marker.length);
        const shift = replacement.length - marker.length;
        element.setSelectionRange(
          oldStart > start ? Math.max(start, oldStart + shift) : oldStart,
          oldEnd > start ? Math.max(start, oldEnd + shift) : oldEnd,
        );
        if (previousFocus instanceof HTMLElement && previousFocus !== element)
          previousFocus.focus({ preventScroll: true });
      }
      queue.current = queue.current.filter((value) => value !== item);
    } catch (error) {
      if (alive.current && queue.current.includes(item)) {
        item.status = "failed";
        item.error = item.controller.signal.aborted
          ? "上传超时，请重试"
          : error instanceof Error
            ? error.message
            : "上传失败";
      }
    } finally {
      clearTimeout(timeout);
      updateQueue();
      void pump();
    }
  }
  function enqueue(files: File[], text = "") {
    const bytes =
      queue.current.reduce((sum, item) => sum + item.file.size, 0) +
      files.reduce((sum, file) => sum + file.size, 0);
    if (queue.current.length + files.length > 10 || bytes > 50 * 1024 * 1024) {
      setNotice("最多排队 10 张图片、合计 50MiB；请完成后再添加。");
      if (text) insert(text);
      return;
    }
    const additions: Upload[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      alt: file.name.replace(/\.[^.]+$/, ""),
      status:
        file.size > 20 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)
          ? "failed"
          : "queued",
      error: file.size > 20 * 1024 * 1024 ? "图片超过上传大小限制" : "仅支持 JPEG、PNG、WebP",
    }));
    insert(
      text + (text ? "\n" : "") + additions.map((item) => uploadMarker(item.id)).join("\n") + "\n",
    );
    queue.current.push(...additions);
    setNotice("图片按插入顺序上传；刷新后本地失败文件不能恢复。");
    updateQueue();
    void pump();
  }
  function toolbar(prefix: string, suffix = "") {
    const current = textarea.current;
    if (!current) return;
    const start = current.selectionStart,
      end = current.selectionEnd;
    insert(prefix + current.value.slice(start, end) + suffix, start, end);
  }
  return (
    <section className={styles.editor} aria-label="Markdown 编辑器">
      <div className={styles.toolbar}>
        {[
          ["edit", "编辑"],
          ["preview", "预览"],
          ["split", "分屏"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant="outline"
            aria-pressed={mode === value}
            className={value === "split" ? styles.splitButton : undefined}
            onClick={() => setMode(value)}
          >
            {label}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => toolbar("## ")}>
          标题
        </Button>
        <Button variant="ghost" onClick={() => toolbar("**", "**")}>
          粗体
        </Button>
        <Button variant="ghost" onClick={() => toolbar("*", "*")}>
          斜体
        </Button>
        <Button variant="ghost" onClick={() => toolbar("- ")}>
          列表
        </Button>
        <Button variant="ghost" onClick={() => toolbar("[", "](https://)")}>
          链接
        </Button>
        <Button variant="ghost" onClick={() => toolbar("\n```text\n", "\n```\n")}>
          代码块
        </Button>
        <Button variant="outline" onClick={() => picker.current?.click()}>
          上传图片
        </Button>
        <Button variant="ghost" onClick={() => setLibrary(true)}>
          媒体库
        </Button>
        <input
          ref={picker}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            enqueue(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
      <div className={styles.panes} data-mode={mode}>
        <div className={styles.editPane}>
          <Label htmlFor="editor-body">Markdown 正文</Label>
          <Textarea
            ref={textarea}
            id="editor-body"
            value={body}
            maxLength={200000}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onChange={(event) => {
              const value = event.target.value;
              setBody(value);
              queue.current = queue.current.filter((item) => {
                if (value.includes(uploadMarker(item.id))) return true;
                item.controller?.abort();
                return false;
              });
              updateQueue();
            }}
            onPaste={(event) => {
              const files = Array.from(event.clipboardData.files);
              if (!files.length) return;
              event.preventDefault();
              enqueue(files, event.clipboardData.getData("text/plain"));
            }}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) event.preventDefault();
            }}
            onDrop={(event) => {
              if (!event.dataTransfer.files.length) return;
              event.preventDefault();
              enqueue(Array.from(event.dataTransfer.files));
            }}
          />
        </div>
        <div className={styles.previewPane} aria-label="当前草稿预览">
          <div className={styles.toolbar}>
            <span role="status">{pending ? "正在更新预览…" : "当前输入预览 · 不会自动保存"}</span>
            <Button variant="ghost" onClick={() => setRefresh((v) => v + 1)}>
              刷新预览
            </Button>
          </div>
          {previewError && <p role="alert">{previewError}</p>}
          <ReadingContent>{preview}</ReadingContent>
        </div>
      </div>
      {notice && <p role="status">{notice}</p>}
      {queue.current.map((item) => (
        <div key={item.id} className={styles.upload}>
          <span>
            {item.file.name} ·{" "}
            {item.status === "failed"
              ? item.error
              : item.status === "queued"
                ? "等待上传"
                : "正在上传…"}
          </span>
          <Label>
            图片说明
            <Input
              maxLength={200}
              value={item.alt}
              onChange={(event) => {
                item.alt = event.target.value;
                updateQueue();
              }}
            />
          </Label>
          {item.status === "failed" && (
            <Button
              variant="outline"
              onClick={() => {
                item.status = "queued";
                void pump();
              }}
            >
              重试
            </Button>
          )}
          <Button variant="ghost" onClick={() => cancel(item.id)}>
            取消
          </Button>
        </div>
      ))}
      {queue.current.length > 0 && (
        <p>图片上传未完成，暂不能发布。保存草稿会去掉上传占位，原始文件仅保留在本页。</p>
      )}
      <Dialog open={library} onOpenChange={setLibrary}>
        <DialogContent className={styles.library} aria-describedby={undefined}>
          <DialogTitle>选择已有图片</DialogTitle>
          <MediaLibrary
            onInsert={(asset) => {
              setLibrary(false);
              insert(imageMarkdown(`/media/${asset.id}`, asset.filename));
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
