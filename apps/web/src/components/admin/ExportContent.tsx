"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@ting-lab/ui";
import styles from "./admin.module.scss";

export function ExportContent() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "pending" | "success" | "error" | "expired">("idle");
  const pending = useRef(false);
  async function download() {
    if (pending.current) return;
    pending.current = true;
    setState("pending");
    try {
      const response = await fetch("/api/admin/export", { cache: "no-store" });
      if (response.status === 401) {
        setState("expired");
        return;
      }
      if (
        !response.ok ||
        !response.headers.get("content-disposition")?.startsWith("attachment") ||
        !response.headers.get("content-type")?.includes("application/json")
      )
        throw new Error("invalid-export");
      const blob = await response.blob();
      const data = JSON.parse(await blob.text()) as { format?: string; articles?: unknown };
      if (data.format !== "ting-lab-content-v1" || !Array.isArray(data.articles))
        throw new Error("invalid-export");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ting-lab-content-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState("success");
    } catch {
      setState("error");
    } finally {
      pending.current = false;
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending.current) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">导出内容</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>导出内容</DialogTitle>
        <DialogDescription>
          下载 ting-lab-content-v1 JSON，包含全部文章、笔记与随记各修订的 MDX
          文本，可能包含草稿和回收站。此操作不限于当前筛选或页面，也不是完整数据库备份。
        </DialogDescription>
        <p role="status" className={styles.notice}>
          {state === "pending"
            ? "正在准备，请稍候；准备期间暂不能关闭。"
            : state === "success"
              ? "已发起下载，请查看浏览器下载列表"
              : state === "expired"
                ? "登录已过期，请重新登录。"
                : state === "error"
                  ? "导出失败，未下载文件，请重试。"
                  : "确认后准备下载。"}
        </p>
        {state === "expired" ? (
          <Link href="/admin/login">返回登录</Link>
        ) : (
          <Button disabled={state === "pending"} onClick={() => void download()}>
            {state === "error" ? "重试导出" : "确认导出"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
