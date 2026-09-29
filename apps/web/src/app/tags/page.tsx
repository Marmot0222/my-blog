import type { Metadata } from "next";
import Link from "next/link";

import { getContentRepository } from "@/lib/content";

import styles from "../editorial-page.module.scss";

export const metadata: Metadata = {
  title: "热门话题",
  description: "浏览 Ting Lab 关注的技术话题。",
  alternates: { canonical: "/tags" },
  openGraph: { url: "/tags", title: "热门话题" },
};

export const dynamic = "force-dynamic";
export default async function TagsPage() {
  const contentRepository = await getContentRepository();
  const topics = contentRepository.getAllTags();

  return (
    <>
      <main className={styles.page}>
        <p className={styles.eyebrow}>Index / Topics</p>
        <h1 className={styles.title}>热门话题</h1>
        <p className={styles.description}>从长期关注的技术方向进入内容。</p>
        <ul className={styles.tagList}>
          {topics.map((topic) => (
            <li key={topic.slug}>
              <Link className={styles.tagLink} href={`/tags/${topic.slug}`}>
                # {topic.label} <span>{topic.count}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Link className={styles.secondaryLink} href="/">
            ← 返回首页
          </Link>
        </div>
      </main>
    </>
  );
}
