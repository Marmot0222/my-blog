import Link from "next/link";

import type { PostMetadata, PostVisual } from "@ting-lab/content";

import { formatFullDate } from "@/lib/format-date";

import styles from "./ArticleCard.module.scss";

type ArticleCardProps = Readonly<{
  article: PostMetadata;
}>;

function ArticleVisual({ variant }: Readonly<{ variant: PostVisual }>) {
  return (
    <div className={`${styles.visual} ${styles[variant]}`} aria-hidden="true">
      <span className={styles.visualGrid} />
      <span className={styles.visualPrimary} />
      <span className={styles.visualSecondary} />
      <span className={styles.visualAccent} />
    </div>
  );
}

export function ArticleCard({ article }: ArticleCardProps) {
  const visual = article.visual ?? "interface";

  return (
    <article className={styles.card} id={article.slug}>
      <Link className={styles.cardLink} href={`/posts/${article.slug}`}>
        <ArticleVisual variant={visual} />
        <div className={styles.content}>
          <div className={styles.meta}>
            <span>{article.category}</span>
            <time dateTime={article.date}>{formatFullDate(article.date)}</time>
          </div>
          <h3>{article.title}</h3>
          <p>{article.description}</p>
          <span className={styles.arrow} aria-hidden="true">
            →
          </span>
        </div>
      </Link>
    </article>
  );
}
