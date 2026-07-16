import type { PostMetadata } from "@ting-lab/content";

import { ArticleCard } from "./ArticleCard";
import styles from "./FeaturedArticles.module.scss";

type FeaturedArticlesProps = Readonly<{
  articles: readonly PostMetadata[];
}>;

export function FeaturedArticles({ articles }: FeaturedArticlesProps) {
  return (
    <section className={styles.section} id="featured" aria-labelledby="featured-title">
      <div className={styles.headingRow}>
        <h2 id="featured-title">精选文章</h2>
        <span>FEATURED / {String(articles.length).padStart(2, "0")}</span>
      </div>
      <div className={styles.grid}>
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
        {articles.length === 0 ? <p className={styles.empty}>精选文章正在整理中。</p> : null}
      </div>
    </section>
  );
}
