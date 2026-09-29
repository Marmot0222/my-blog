"use client";
import { useState } from "react";
import type { settingsSummary } from "@ting-lab/publishing";
import {
  Button,
  Input,
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
type Summary = Awaited<ReturnType<typeof settingsSummary>>;
export function AiSettings({ initial }: { initial: Summary }) {
  const [summary, setSummary] = useState(initial),
    [profile, setProfile] = useState(initial.profile),
    [mode, setMode] = useState<"keep" | "replace">("keep"),
    [key, setKey] = useState(""),
    [embeddingKey, setEmbeddingKey] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [testKind, setTestKind] = useState<"chat" | "embedding" | null>(null),
    [remove, setRemove] = useState(false);
  const dirty = JSON.stringify(profile) !== JSON.stringify(summary.profile) || mode === "replace";
  async function perform(action: string, data: unknown) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/settings/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message);
        return;
      }
      setKey("");
      setEmbeddingKey("");
      setMode("keep");
      setTestKind(null);
      setRemove(false);
      setMessage(
        action === "test"
          ? `${result.ok ? "连接成功" : "连接不可用"} · ${result.durationMs}ms`
          : action === "activate"
            ? "已激活，下一次请求开始生效。"
            : action === "save"
              ? "配置草稿已保存，尚未激活。"
              : "操作完成。",
      );
      const state = await fetch("/api/admin/settings", { cache: "no-store" });
      if (state.ok) {
        const next: Summary = await state.json();
        setSummary(next);
        setProfile(next.profile);
      }
    } catch {
      setMessage("请求失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>模型配置</h1>
      <p>
        当前来源：{summary.source} · {summary.enabled ? "已启用" : "未启用"} ·{" "}
        {busy ? "正在处理" : summary.pending ? "编辑待激活" : "配置就绪"}
      </p>
      <p>Key：{summary.hasKey ? "已配置" : "未设置"}。仅显示状态，不读取原 Key。</p>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void perform("save", {
            version: summary.draftVersion,
            profile,
            key: mode === "replace" ? { mode, value: key } : { mode },
          });
        }}
      >
        <Label>
          <span>
            <input
              type="checkbox"
              checked={profile.enabled}
              onChange={(event) => setProfile({ ...profile, enabled: event.target.checked })}
            />{" "}
            启用 Chat
          </span>
        </Label>
        <div className={styles.grid}>
          <div>
            <Label htmlFor="provider">供应商</Label>
            <Select
              value={profile.provider}
              onValueChange={(value) => {
                if (value === "openai" || value === "openai-compatible" || value === "google") {
                  setProfile({ ...profile, provider: value });
                  setMode("replace");
                }
              }}
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
                <SelectItem value="google">Google</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Label>
            模型
            <Input
              required
              maxLength={200}
              value={profile.model}
              onChange={(event) => setProfile({ ...profile, model: event.target.value })}
            />
          </Label>
          <Label>
            Base URL
            <Input
              type="url"
              required
              value={profile.baseURL}
              onChange={(event) => {
                setProfile({ ...profile, baseURL: event.target.value });
                setMode("replace");
              }}
            />
          </Label>
          <Label>
            超时（毫秒）
            <Input
              type="number"
              min={1000}
              max={120000}
              value={profile.requestTimeoutMs}
              onChange={(event) =>
                setProfile({ ...profile, requestTimeoutMs: Number(event.target.value) })
              }
            />
          </Label>
          <Label>
            输出 token 上限
            <Input
              type="number"
              min={1}
              max={8192}
              value={profile.maxOutputTokens}
              onChange={(event) =>
                setProfile({ ...profile, maxOutputTokens: Number(event.target.value) })
              }
            />
          </Label>
        </div>
        <div>
          <Label htmlFor="key-mode">Key 操作</Label>
          <Select
            value={mode}
            onValueChange={(value) => setMode(value === "replace" ? "replace" : "keep")}
          >
            <SelectTrigger id="key-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep">保持原 Key</SelectItem>
              <SelectItem value="replace">替换 Key</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {mode === "replace" ? (
          <Label>
            新 API Key
            <Input
              type="password"
              autoComplete="new-password"
              required
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </Label>
        ) : null}
        <p>切换供应商或地址需要新 Key；目标主机必须在服务器批准列表中。</p>
        <div className={styles.actions}>
          <Button disabled={busy}>保存配置草稿</Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || dirty || !summary.draftVersion}
            onClick={() => setTestKind("chat")}
          >
            测试 Chat 连接
          </Button>
          <Button
            type="button"
            disabled={busy || dirty || !summary.draftVersion}
            onClick={() => void perform("activate", { version: summary.draftVersion })}
          >
            激活配置
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setRemove(true)}>
            移除数据库覆盖
          </Button>
        </div>
      </form>
      <h2>Embedding（向量空间只读）</h2>
      <p>
        {summary.embedding.configured
          ? `${summary.embedding.provider} / ${summary.embedding.model} / ${summary.embedding.dimensions} 维`
          : "未配置，需要先由服务器初始化"}
      </p>
      <p>{summary.embedding.baseURL}</p>
      <p>更换模型或地址需要受控全量重建；修改 Chat 不会改变该空间。</p>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void perform("embedding", { value: embeddingKey });
        }}
      >
        <Label>
          替换独立 Embedding Key
          <Input
            type="password"
            autoComplete="new-password"
            required
            value={embeddingKey}
            onChange={(event) => setEmbeddingKey(event.target.value)}
          />
        </Label>
        <div className={styles.actions}>
          <Button disabled={busy || !summary.embedding.configured}>替换 Embedding Key</Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !summary.embedding.configured}
            onClick={() => setTestKind("embedding")}
          >
            测试 Embedding 连接
          </Button>
        </div>
      </form>
      <p role="status" className={message ? styles.notice : undefined}>
        {message}
      </p>
      <Dialog
        open={!!testKind || remove}
        onOpenChange={(open) => {
          if (!open) {
            setTestKind(null);
            setRemove(false);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>{remove ? "移除数据库覆盖" : "连接测试"}</DialogTitle>
          <DialogDescription>
            {remove
              ? "后续 Chat 请求将使用完整环境变量配置。服务器 env 中的模型可能重新启用。"
              : "将向当前供应商发送固定短文本，可能产生少量费用。Embedding 测试不会写入索引。"}
          </DialogDescription>
          <Button
            disabled={busy}
            onClick={() =>
              void perform(
                remove ? "remove" : "test",
                remove ? {} : { kind: testKind, version: summary.draftVersion || undefined },
              )
            }
          >
            {remove ? "确认移除" : "确认测试"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
