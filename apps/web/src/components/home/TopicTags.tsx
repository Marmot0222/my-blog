import Link from "next/link";

import styles from "./TopicTags.module.scss";

type TopicTagsProps = Readonly<{
  topics: readonly string[];
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
          <li key={topic}>
            <Link href="#featured"># {topic}</Link>
          </li>
        ))}
      </ul>
      <Link className={styles.more} href="#featured">
        查看全部话题 <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
