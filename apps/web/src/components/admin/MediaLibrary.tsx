"use client";
import { useEffect, useState } from "react";
import { ContentImage } from "@/components/mdx/ReadingContent";
import { Button, Dialog, DialogContent, DialogTitle, DialogDescription } from "@ting-lab/ui";
import type { Asset } from "@ting-lab/media/client";
import { imageMarkdown } from "./upload-state";
import styles from "./MediaLibrary.module.scss";

export function MediaLibrary({ onInsert }: { onInsert?: (asset: Asset) => void }) {
  const [items, setItems] = useState<Asset[]>([]),
    [page, setPage] = useState(1),
    [next, setNext] = useState(false),
    [refresh, setRefresh] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<Asset | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    void fetch(`/api/admin/media?page=${page}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (!controller.signal.aborted) {
          setItems(data.items);
          setNext(data.hasNext);
          setMessage("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message ?? "媒体库不可用");
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [page, refresh]);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("已复制");
    } catch {
      setMessage("复制失败，请重试");
    }
  }
  return (
    <div>
      <p>图片默认私有，文章发布后才允许匿名读取。内容 JSON 导出不包含图片二进制。</p>
      <p role="status">{busy ? "正在读取媒体库…" : message}</p>
      <Button variant="ghost" onClick={() => setRefresh((v) => v + 1)}>
        刷新媒体库
      </Button>
      <div className={styles.grid}>
        {items.map((asset) => (
          <article key={asset.id} className={styles.card}>
            <ContentImage
              src={`/media/${asset.id}`}
              alt={asset.filename}
              width={asset.width}
              height={asset.height}
            />
            <p>{asset.filename}</p>
            <small>
              {asset.width} × {asset.height} · {Math.ceil(asset.bytes / 1024)} KiB ·{" "}
              {asset.access === "public" ? "公开引用" : "私有"} ·{" "}
              {asset.protected ? "有关联保护" : "未关联上传"}
            </small>
            <div className={styles.actions}>
              {onInsert && <Button onClick={() => onInsert(asset)}>插入</Button>}
              <Button variant="outline" onClick={() => void copy(`/media/${asset.id}`)}>
                复制 URL
              </Button>
              <Button
                variant="ghost"
                onClick={() => void copy(imageMarkdown(`/media/${asset.id}`, asset.filename))}
              >
                复制 Markdown
              </Button>
              <Button
                variant="destructive"
                disabled={asset.protected}
                onClick={() => setRemove(asset)}
              >
                删除
              </Button>
            </div>
          </article>
        ))}
      </div>
      <div className={styles.actions}>
        <Button
          variant="outline"
          disabled={page === 1 || busy}
          onClick={() => setPage((v) => v - 1)}
        >
          上一页
        </Button>
        <span>第 {page} 页</span>
        <Button variant="outline" disabled={!next || busy} onClick={() => setPage((v) => v + 1)}>
          下一页
        </Button>
      </div>
      <Dialog
        open={!!remove}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
      >
        <DialogContent>
          <DialogTitle>删除未关联图片？</DialogTitle>
          <DialogDescription>仅删除没有任何修订保护的上传。此操作无法撤销。</DialogDescription>
          {message && <p role="alert">{message}</p>}
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (!remove) return;
              setBusy(true);
              try {
                const response = await fetch(`/api/admin/media/${remove.id}`, { method: "DELETE" });
                if (!response.ok) {
                  const data = await response.json();
                  setMessage(data.message);
                  return;
                }
                setRemove(null);
                setRefresh((v) => v + 1);
              } catch {
                setMessage("删除失败，请重试");
              } finally {
                setBusy(false);
              }
            }}
          >
            确认删除
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
