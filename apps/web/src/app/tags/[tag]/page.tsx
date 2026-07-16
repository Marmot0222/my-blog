import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostList } from "@/components/article/PostList";
import { SiteHeader } from "@/components/home/SiteHeader";
import { contentRepository } from "@/lib/content";

import styles from "../../editorial-page.module.scss";

type TagPageProps = Readonly<{
  params: Promise<{ tag: string }>;
}>;

export const dynamicParams = false;

export function generateStaticParams() {
  return contentRepository.getAllTags().map(({ slug }) => ({ tag: slug }));
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const topic = contentRepository.getAllTags().find((candidate) => candidate.slug === tag);

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
  const topic = contentRepository.getAllTags().find((candidate) => candidate.slug === tag);

  if (!topic) {
    notFound();
  }

  const posts = contentRepository.getPostsByTag(topic.slug);

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <p className={styles.eyebrow}>Topic / {topic.slug}</p>
        <h1 className={styles.title}># {topic.label}</h1>
        <p className={styles.description}>共 {topic.count} 篇内容，按发布时间从新到旧排列。</p>
        <PostList posts={posts} emptyMessage="这个话题下暂无已发布内容。" />
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
