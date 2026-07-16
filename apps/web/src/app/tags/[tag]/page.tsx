import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/home/SiteHeader";
import { getTopicBySlug, topics } from "@/data/home";

import styles from "../../editorial-page.module.scss";

type TagPageProps = Readonly<{
  params: Promise<{ tag: string }>;
}>;

export function generateStaticParams() {
  return topics.map(({ slug }) => ({ tag: slug }));
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const topic = getTopicBySlug(tag);

  if (!topic) {
    return { title: "话题未找到 — Ting Lab" };
  }

  return {
    title: `${topic.label} — Ting Lab`,
    description: `Ting Lab 中与 ${topic.label} 相关的内容。`,
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  const topic = getTopicBySlug(tag);

  if (!topic) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <p className={styles.eyebrow}>Topic / {topic.slug}</p>
        <h1 className={styles.title}># {topic.label}</h1>
        <p className={styles.description}>相关内容将在这里展示。</p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href="/tags">
            ← 返回话题总览
          </Link>
          <Link className={styles.secondaryLink} href="/">
            返回首页
          </Link>
        </div>
      </main>
    </>
  );
}
