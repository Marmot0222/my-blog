import Link from "next/link";

import type { FeaturedArticle } from "@/data/home";

import styles from "./ArticleCard.module.scss";

type ArticleCardProps = Readonly<{
  article: FeaturedArticle;
}>;

function ArticleVisual({ variant }: Readonly<{ variant: FeaturedArticle["visual"] }>) {
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
  return (
    <article className={styles.card} id={article.id}>
      <Link className={styles.cardLink} href={`#${article.id}`}>
        <ArticleVisual variant={article.visual} />
        <div className={styles.content}>
          <div className={styles.meta}>
            <span>{article.category}</span>
            <time dateTime={article.date.replaceAll(".", "-")}>{article.date}</time>
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
