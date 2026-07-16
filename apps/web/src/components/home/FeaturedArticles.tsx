import type { FeaturedArticle } from "@/data/home";

import { ArticleCard } from "./ArticleCard";
import styles from "./FeaturedArticles.module.scss";

type FeaturedArticlesProps = Readonly<{
  articles: readonly FeaturedArticle[];
}>;

export function FeaturedArticles({ articles }: FeaturedArticlesProps) {
  return (
    <section className={styles.section} id="featured" aria-labelledby="featured-title">
      <div className={styles.headingRow}>
        <h2 id="featured-title">精选文章</h2>
        <span>FEATURED / 03</span>
      </div>
      <div className={styles.grid}>
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
