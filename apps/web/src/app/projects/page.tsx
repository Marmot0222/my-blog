import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/home/SiteHeader";

import styles from "../editorial-page.module.scss";

export const metadata: Metadata = {
  title: "项目 — Ting Lab",
  description: "正在构建和持续维护的实验性项目。",
};

export default function ProjectsPage() {
  return (
    <>
      <SiteHeader activeItem="projects" />
      <main className={styles.page}>
        <p className={styles.eyebrow}>Selected / Projects</p>
        <h1 className={styles.title}>项目</h1>
        <p className={styles.description}>正在构建和持续维护的实验性项目。</p>
        <div className={styles.actions}>
          <Link className={styles.secondaryLink} href="/">
            ← 返回首页
          </Link>
        </div>
      </main>
    </>
  );
}
