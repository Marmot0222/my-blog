import { postKindLabels } from "@ting-lab/content";
import type { PostMetadata } from "@ting-lab/content";
import Link from "next/link";
import { LinkPending } from "@/components/navigation/LinkPending";

import { formatFullDate } from "@/lib/format-date";

import styles from "./PostList.module.scss";

type PostListProps = Readonly<{
  posts: readonly PostMetadata[];
  emptyMessage?: string;
  headingLevel?: 2 | 3;
}>;

export function PostList({
  posts,
  emptyMessage = "暂无已发布内容。",
  headingLevel = 2,
}: PostListProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  if (posts.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <ol className={styles.list}>
      {posts.map((post) => (
        <li key={post.slug}>
          <article className={styles.item}>
            <div className={styles.meta}>
              <span>{postKindLabels[post.kind]}</span>
              <span>{post.category}</span>
              <time dateTime={post.date}>{formatFullDate(post.date)}</time>
              <span>{post.readingTime}</span>
            </div>
            <Heading>
              <Link href={`/posts/${post.slug}`}>
                {post.title}
                <LinkPending />
              </Link>
            </Heading>
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
