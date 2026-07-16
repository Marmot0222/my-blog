import Link from "next/link";

import type { Topic } from "@/data/home";

import styles from "./TopicTags.module.scss";

type TopicTagsProps = Readonly<{
  topics: readonly Topic[];
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
      <Link className={styles.more} href="/tags">
        查看全部话题 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
