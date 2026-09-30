import styles from "./ArticleSkeleton.module.scss";

export function ArchiveSkeleton() {
  return (
    <section aria-busy="true" aria-label="正在加载文章列表">
      <p role="status">正在加载文章列表…</p>
      <div aria-hidden="true">
        <div className={styles.controls} />
        {Array.from({ length: 3 }, (_, index) => (
          <div className={styles.item} key={index}>
            <div className={styles.line} />
            <div className={styles.line} />
            <div className={styles.line} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ArticleBodySkeleton() {
  return (
    <section aria-busy="true" aria-label="正在加载文章正文">
      <p role="status">正在加载正文…</p>
      <div className={styles.layout} aria-hidden="true">
        <div>
          {Array.from({ length: 10 }, (_, index) => (
            <div className={styles.line} key={index} />
          ))}
        </div>
        <div className={styles.toc} />
      </div>
    </section>
  );
}
