import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/home/SiteHeader";

import styles from "../editorial-page.module.scss";

export const metadata: Metadata = {
  title: "关于",
  description: "一名持续学习、记录与构建的前端开发者。",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about", title: "关于" },
};

export default function AboutPage() {
  return (
    <>
      <SiteHeader activeItem="about" />
      <main className={styles.page}>
        <p className={styles.eyebrow}>Profile / About</p>
        <h1 className={styles.title}>关于</h1>
        <p className={styles.description}>一名持续学习、记录与构建的前端开发者。</p>
        <div className={styles.actions}>
          <Link className={styles.secondaryLink} href="/">
            ← 返回首页
          </Link>
        </div>
      </main>
    </>
  );
}
