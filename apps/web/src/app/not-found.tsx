import Link from "next/link";

import { SiteHeader } from "@/components/home/SiteHeader";

import styles from "./editorial-page.module.scss";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <p className={styles.eyebrow}>Not Found</p>
        <h1 className={styles.notFoundTitle}>404</h1>
        <p className={styles.description}>内容不存在，或尚未发布。</p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href="/">
            ← 返回首页
          </Link>
        </div>
      </main>
    </>
  );
}
