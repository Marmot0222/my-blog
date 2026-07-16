import { tagToSlug } from "@ting-lab/content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleToc } from "@/components/article/ArticleToc";
import { SiteHeader } from "@/components/home/SiteHeader";
import { compilePostMdx } from "@/components/mdx/MdxContent";
import { contentRepository } from "@/lib/content";
import { formatFullDate } from "@/lib/format-date";

import styles from "./page.module.scss";

type PostPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export const dynamicParams = false;

export function generateStaticParams() {
  return contentRepository.getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = contentRepository.getPostBySlug(slug);

  if (!post?.metadata.published) {
    return { title: "内容未找到 — Ting Lab" };
  }

  const { metadata } = post;

  return {
    title: `${metadata.title} — Ting Lab`,
    description: metadata.description,
    authors: [{ name: "Ting Lab" }],
    keywords: metadata.tags,
    openGraph: {
      type: "article",
      title: metadata.title,
      description: metadata.description,
      publishedTime: metadata.date,
      modifiedTime: metadata.updatedAt,
      authors: ["Ting Lab"],
      tags: metadata.tags,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = contentRepository.getPostBySlug(slug);

  if (!post?.metadata.published) {
    notFound();
  }

  const { metadata, content } = post;
  const compiled = await compilePostMdx(content);

  return (
    <>
      <SiteHeader activeItem="posts" />
      <main className={styles.page}>
        <article>
          <header className={styles.header}>
            <p className={styles.eyebrow}>
              {metadata.kind === "article" ? "Article" : "Note"} / {metadata.category}
            </p>
            <h1>{metadata.title}</h1>
            <p className={styles.description}>{metadata.description}</p>
            <div className={styles.meta}>
              <time dateTime={metadata.date}>发布于 {formatFullDate(metadata.date)}</time>
              {metadata.updatedAt ? (
                <time dateTime={metadata.updatedAt}>
                  更新于 {formatFullDate(metadata.updatedAt)}
                </time>
              ) : null}
              <span>{metadata.readingTime}</span>
            </div>
            <ul className={styles.tags} aria-label="文章标签">
              {metadata.tags.map((tag) => (
                <li key={tag}>
                  <Link href={`/tags/${tagToSlug(tag)}`}># {tag}</Link>
                </li>
              ))}
            </ul>
          </header>

          <div className={styles.articleLayout}>
            <div className={styles.body}>{compiled.content}</div>
            <ArticleToc headings={compiled.headings} />
          </div>

          <footer className={styles.footer}>
            <Link href="/posts">← 返回文章列表</Link>
          </footer>
        </article>
      </main>
    </>
  );
}
