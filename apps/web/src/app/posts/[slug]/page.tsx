import { postKindLabels } from "@ting-lab/content";
import { scheduler } from "node:timers/promises";
import { tagToSlug } from "@ting-lab/content";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { ArticleBodySkeleton } from "@/components/article/ArticleSkeleton";

import { ArticleToc } from "@/components/article/ArticleToc";
import { PostList } from "@/components/article/PostList";
import { compilePostMdx } from "@/components/mdx/MdxContent";
import { getContentRepository } from "@/lib/content";
import { formatFullDate } from "@/lib/format-date";
import { serializeJsonLd } from "@/lib/seo";
import { absoluteUrl, siteConfig } from "@/lib/site";

import styles from "./page.module.scss";

type PostPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export const dynamicParams = true;
export const dynamic = "force-dynamic";

// File repositories read on access; share the resolved post as well as the
// repository so metadata and body use the same revision within this request.
const getPost = cache(async (slug: string) => {
  const repository = await getContentRepository();
  return repository.getPostBySlug(slug);
});

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post?.metadata.published) {
    return { title: "内容未找到", robots: { index: false, follow: false } };
  }

  const { metadata } = post;

  return {
    title: metadata.title,
    description: metadata.description,
    authors: [{ name: siteConfig.author }],
    alternates: { canonical: `/posts/${metadata.slug}` },
    openGraph: {
      type: "article",
      url: `/posts/${metadata.slug}`,
      title: metadata.title,
      description: metadata.description,
      publishedTime: metadata.date,
      modifiedTime: metadata.updatedAt,
      authors: [siteConfig.author],
      tags: metadata.tags,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
      images: ["/opengraph-image"],
    },
  };
}

async function ArticleBody({ content }: Readonly<{ content: string }>) {
  // Give the shell a turn to flush before CPU-bound Markdown work. This is
  // cooperative scheduling, not a timed delay or minimum loading duration.
  await scheduler.yield();
  const compiled = await compilePostMdx(content);
  return (
    <div className={styles.articleLayout}>
      <div className={styles.body}>{compiled.content}</div>
      <ArticleToc headings={compiled.headings} />
    </div>
  );
}

export default async function PostPage({ params }: PostPageProps) {
  const contentRepository = await getContentRepository();
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post?.metadata.published) {
    notFound();
  }

  const { metadata, content } = post;
  const related = contentRepository.getRelatedPosts(slug);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: metadata.title,
            description: metadata.description,
            url: absoluteUrl(`/posts/${metadata.slug}`),
            mainEntityOfPage: absoluteUrl(`/posts/${metadata.slug}`),
            datePublished: metadata.date,
            dateModified: metadata.updatedAt ?? metadata.date,
            inLanguage: siteConfig.language,
            author: { "@type": "Person", name: siteConfig.author, url: absoluteUrl("/about") },
            keywords: metadata.tags,
          }),
        }}
      />
      <main className={styles.page}>
        <article>
          <header className={styles.header}>
            <p className={styles.eyebrow}>
              {postKindLabels[metadata.kind]} / {metadata.category}
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

          <Suspense fallback={<ArticleBodySkeleton />}>
            <ArticleBody content={content} />
          </Suspense>

          <footer className={styles.footer}>
            <Link href="/posts">← 返回文章列表</Link>
          </footer>
        </article>
        {related.length ? (
          <section className={styles.related} aria-labelledby="related-heading">
            <h2 id="related-heading">相关阅读</h2>
            <PostList posts={related} headingLevel={3} />
          </section>
        ) : null}
      </main>
    </>
  );
}
