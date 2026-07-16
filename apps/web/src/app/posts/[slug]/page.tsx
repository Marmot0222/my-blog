import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/home/SiteHeader";
import { featuredArticles, formatFullDate, getPostBySlug, latestNotes } from "@/data/home";

import styles from "../../editorial-page.module.scss";

type PostPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export function generateStaticParams() {
  return [...featuredArticles, ...latestNotes].map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "内容未找到 — Ting Lab" };
  }

  return {
    title: `${post.title} — Ting Lab`,
    description: post.description,
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <SiteHeader activeItem="posts" />
      <main className={styles.page}>
        <article>
          <p className={styles.eyebrow}>
            {post.category} / <time dateTime={post.date}>{formatFullDate(post.date)}</time>
          </p>
          <h1 className={styles.title}>{post.title}</h1>
          <p className={styles.description}>{post.description}</p>
          <div className={styles.rule} aria-hidden="true" />
          <p className={styles.notice}>正文内容尚未发布，本轮仅保留静态详情入口。</p>
          <div className={styles.actions}>
            <Link className={styles.primaryLink} href="/posts">
              ← 返回文章列表
            </Link>
            <Link className={styles.secondaryLink} href="/">
              返回首页
            </Link>
          </div>
        </article>
      </main>
    </>
  );
}
