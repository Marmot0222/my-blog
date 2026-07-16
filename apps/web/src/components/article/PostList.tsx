import type { PostMetadata } from "@ting-lab/content";
import Link from "next/link";

import { formatFullDate } from "@/lib/format-date";

import styles from "./PostList.module.scss";

type PostListProps = Readonly<{
  posts: readonly PostMetadata[];
  emptyMessage?: string;
}>;

export function PostList({ posts, emptyMessage = "暂无已发布内容。" }: PostListProps) {
  if (posts.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <ol className={styles.list}>
      {posts.map((post) => (
        <li key={post.slug}>
          <article className={styles.item}>
            <div className={styles.meta}>
              <span>{post.kind === "article" ? "文章" : "笔记"}</span>
              <span>{post.category}</span>
              <time dateTime={post.date}>{formatFullDate(post.date)}</time>
              <span>{post.readingTime}</span>
            </div>
            <h2>
              <Link href={`/posts/${post.slug}`}>{post.title}</Link>
            </h2>
            <p>{post.description}</p>
            <ul className={styles.tags} aria-label={`${post.title} 的标签`}>
              {post.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </article>
        </li>
      ))}
    </ol>
  );
}
