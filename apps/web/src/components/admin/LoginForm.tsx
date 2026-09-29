"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@ting-lab/ui";
import styles from "./admin.module.scss";
export function LoginForm() {
  const router = useRouter(),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const form = event.currentTarget;
        try {
          const response = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: new FormData(form).get("password") }),
          });
          const result = await response.json();
          if (!response.ok) {
            setMessage(result.message);
            return;
          }
          form.reset();
          router.replace("/admin");
          router.refresh();
        } catch {
          setMessage("连接失败，请稍后重试。");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Label>
        管理员密码
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
        />
      </Label>
      <Button disabled={busy}>{busy ? "正在登录…" : "登录"}</Button>
      <p role="status">{message}</p>
    </form>
  );
}
