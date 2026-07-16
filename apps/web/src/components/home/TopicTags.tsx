import Link from "next/link";

import type { TagSummary } from "@ting-lab/content";

import styles from "./TopicTags.module.scss";

type TopicTagsProps = Readonly<{
  topics: readonly TagSummary[];
}>;

export function TopicTags({ topics }: TopicTagsProps) {
  return (
    <div className={styles.block}>
      <div className={styles.titleRow}>
        <h2>热门话题</h2>
        <span>TOPICS</span>
      </div>
      <ul>
        {topics.map((topic) => (
          <li key={topic.slug}>
            <Link href={`/tags/${topic.slug}`}># {topic.label}</Link>
          </li>
        ))}
      </ul>
      {topics.length === 0 ? <p className={styles.empty}>暂无话题。</p> : null}
      <Link className={styles.more} href="/tags">
        查看全部话题 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
