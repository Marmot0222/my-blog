import type { Metadata } from "next";
import Link from "next/link";

import { PostFilters } from "@/components/article/PostFilters";
import { PostList } from "@/components/article/PostList";
import { SiteHeader } from "@/components/home/SiteHeader";
import { getContentRepository } from "@/lib/content";

import styles from "../editorial-page.module.scss";
import archive from "./page.module.scss";

const metadata: Metadata = {
  title: "文章",
  description: "关于前端工程、系统设计与 AI 应用的长期记录。",
  alternates: { canonical: "/posts" },
  openGraph: { url: "/posts", title: "文章" },
};

type Props = Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return {
    ...metadata,
    ...(Object.keys(await searchParams).length ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function PostsPage({ searchParams }: Props) {
  const contentRepository = await getContentRepository();
  const params = await searchParams;
  const result = contentRepository.queryPosts({
    kind: first(params.kind),
    tag: first(params.tag),
    page: first(params.page),
  });
  const tags = contentRepository.getAllTags();
  const selectedTag = tags.find((tag) => tag.slug === result.tag);
  const href = (page: number) => {
    const query = new URLSearchParams();
    if (result.kind) query.set("kind", result.kind);
    if (result.tag) query.set("tag", result.tag);
    if (page > 1) query.set("page", String(page));
    return `/posts${query.size ? `?${query}` : ""}`;
  };

  return (
    <>
      <SiteHeader activeItem="posts" />
      <main className={styles.page}>
        <p className={styles.eyebrow}>Archive / Posts</p>
        <h1 className={styles.title}>文章</h1>
        <p className={styles.description}>关于前端工程、系统设计与 AI 应用的长期记录。</p>
        <PostFilters tags={tags} />
        <p className={archive.status} role="status">
          {result.kind === "article" ? "文章" : result.kind === "note" ? "笔记" : "全部内容"} ·{" "}
          {selectedTag?.label ?? (result.tag ? "未知标签" : "全部标签")} · 共 {result.total} 篇 · 第{" "}
          {result.page} / {result.pageCount} 页
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
            <span aria-current="page">
              第 {result.page} / {result.pageCount} 页
            </span>
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
