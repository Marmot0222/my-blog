import type { Metadata } from "next";
import Link from "next/link";

import { PostList } from "@/components/article/PostList";
import { SiteHeader } from "@/components/home/SiteHeader";
import { contentRepository } from "@/lib/content";

import styles from "../editorial-page.module.scss";

export const metadata: Metadata = {
  title: "文章",
  description: "关于前端工程、系统设计与 AI 应用的长期记录。",
  alternates: { canonical: "/posts" },
  openGraph: { url: "/posts", title: "文章" },
};

export default function PostsPage() {
  const posts = contentRepository.getPublishedPosts();

  return (
    <>
      <SiteHeader activeItem="posts" />
      <main className={styles.page}>
        <p className={styles.eyebrow}>Archive / Posts</p>
        <h1 className={styles.title}>文章</h1>
        <p className={styles.description}>关于前端工程、系统设计与 AI 应用的长期记录。</p>
        <PostList posts={posts} />
        <div className={styles.actions}>
          <Link className={styles.secondaryLink} href="/">
            ← 返回首页
          </Link>
        </div>
      </main>
    </>
  );
}
