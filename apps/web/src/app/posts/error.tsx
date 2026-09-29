"use client";

import Link from "next/link";
import { Button } from "@ting-lab/ui";
import styles from "../editorial-page.module.scss";

export default function PostsError({ reset }: { reset(): void }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>内容暂时不可用</h1>
      <p className={styles.description}>未能加载这次筛选或文章，请重试。</p>
      <div className={styles.actions}>
        <Button onClick={reset}>重试加载</Button>
        <Link href="/posts">返回全部文章</Link>
      </div>
    </main>
  );
}
