import type { TocHeading } from "@/components/mdx/MdxContent";

import styles from "./ArticleToc.module.scss";

type ArticleTocProps = Readonly<{
  headings: readonly TocHeading[];
}>;

export function ArticleToc({ headings }: ArticleTocProps) {
  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className={styles.toc} aria-label="文章目录">
      <p>目录</p>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level === 3 ? styles.nested : undefined}>
            <a href={`#${heading.id}`}>{heading.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
