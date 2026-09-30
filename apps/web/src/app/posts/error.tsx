"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@ting-lab/ui";
import styles from "../editorial-page.module.scss";

export default function PostsError({ reset }: Readonly<{ reset: () => void }>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>内容暂时无法加载</h1>
      <p className={styles.description}>请求未能完成，请重试或返回文章列表。</p>
      <div className={styles.actions}>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          {pending ? "正在重试…" : "重新加载"}
        </Button>
        <Link href="/posts">返回文章列表</Link>
      </div>
    </main>
  );
}
