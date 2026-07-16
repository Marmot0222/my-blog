import Link from "next/link";

import type { PostMetadata } from "@ting-lab/content";

import styles from "./HeroSection.module.scss";

type HeroSectionProps = Readonly<{
  articles: readonly PostMetadata[];
}>;

export function HeroSection({ articles }: HeroSectionProps) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.copy}>
        <p className={styles.kicker}>PERSONAL TECHNOLOGY JOURNAL · 2026</p>
        <h1 id="hero-title">
          记录技术，
          <br />
          也让知识可以被提问<span>。</span>
        </h1>
        <p className={styles.description}>记录编码、设计、思考与实践的过程。</p>
        <Link className={styles.primaryAction} href="/posts">
          阅读最新文章
          <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className={styles.index} aria-label="精选文章索引">
        <ol>
          {articles.map((article, index) => (
            <li key={article.slug} className={index === 0 ? styles.current : undefined}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <i aria-hidden="true" />
              <Link href={`/posts/${article.slug}`}>{article.title}</Link>
            </li>
          ))}
        </ol>
        {articles.length === 0 ? <p>精选内容正在整理中。</p> : null}
        <Link className={styles.allArticles} href="/posts">
          查看全部文章 <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
