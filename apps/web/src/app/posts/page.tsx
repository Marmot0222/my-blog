import { postKindLabels } from "@ting-lab/content";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { archiveUrl } from "@/lib/seo";
import { ArchiveSkeleton } from "@/components/article/ArticleSkeleton";

import { PostFilters } from "@/components/article/PostFilters";
import { PostList } from "@/components/article/PostList";
import { getContentRepository } from "@/lib/content";

import styles from "../editorial-page.module.scss";
import archive from "./page.module.scss";

const metadata: Metadata = {
  title: "文章",
  description: "关于技术、生活与日常思考的长期记录。",
  alternates: { canonical: "/posts" },
  openGraph: { url: "/posts", title: "文章" },
};

type Props = Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const repository = await getContentRepository();
  const params = await searchParams;
  const result = repository.queryPosts({
    kind: first(params.kind),
    category: first(params.category),
    tag: first(params.tag),
    page: first(params.page),
  });
  const canonical = archiveUrl(result);
  const title = result.page > 1 ? `文章 · 第 ${result.page} 页` : "文章";
  return {
    ...metadata,
    title,
    alternates: { canonical },
    openGraph: { url: canonical, title },
    robots: { index: !Boolean(result.kind || result.category || result.tag), follow: true },
  };
}

export default function PostsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <h1 className={styles.title}>文章</h1>
          <ArchiveSkeleton />
        </main>
      }
    >
      <PostsArchive {...props} />
    </Suspense>
  );
}

async function PostsArchive({ searchParams }: Props) {
  const contentRepository = await getContentRepository();
  const params = await searchParams;
  const result = contentRepository.queryPosts({
    kind: first(params.kind),
    tag: first(params.tag),
    category: first(params.category),
    page: first(params.page),
  });
  const categories = [
    ...new Set(contentRepository.getPublishedPosts().map((post) => post.category)),
  ].sort();
  const tags = contentRepository.getAllTags();
  const selectedTag = tags.find((tag) => tag.slug === result.tag);
  const href = (page: number) => {
    return archiveUrl({ ...result, page });
  };

  return (
    <>
      <main className={`${styles.page} ${archive.page}`}>
        <p className={styles.eyebrow}>Archive / Posts</p>
        <h1 className={styles.title}>文章</h1>
        <p className={styles.description}>关于技术、生活与日常思考的长期记录。</p>
        <PostFilters tags={tags} categories={categories} />
        <p className={archive.status} role="status">
          {result.kind ? postKindLabels[result.kind] : "全部内容"} · {result.category ?? "全部分类"}{" "}
          · {selectedTag?.label ?? (result.tag ? "未知标签" : "全部标签")} · 共 {result.total} 篇 ·
          第 {result.page} / {result.pageCount} 页
        </p>
        {result.total ? (
          <PostList posts={result.posts} />
        ) : (
          <p className={archive.empty}>
            没有符合条件的内容。<Link href="/posts">清除筛选，查看全部内容</Link>
          </p>
        )}
        {result.pageCount > 1 ? (
          <nav className={archive.pagination} aria-label="文章分页">
            {result.page > 1 ? (
              <Link href={href(result.page - 1)}>← 上一页</Link>
            ) : (
              <span>已是首页</span>
            )}
            {Array.from({ length: result.pageCount }, (_, index) => index + 1)
              .filter(
                (page) =>
                  page === 1 || page === result.pageCount || Math.abs(page - result.page) <= 1,
              )
              .map((page) => (
                <Link
                  key={page}
                  href={href(page)}
                  aria-current={page === result.page ? "page" : undefined}
                >
                  {page}
                </Link>
              ))}
            {result.page < result.pageCount ? (
              <Link href={href(result.page + 1)}>下一页 →</Link>
            ) : (
              <span>已是末页</span>
            )}
          </nav>
        ) : null}
        <div className={styles.actions}>
          <Link className={styles.secondaryLink} href="/">
            ← 返回首页
          </Link>
        </div>
      </main>
    </>
  );
}
