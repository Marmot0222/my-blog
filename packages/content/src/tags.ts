import type { PostMetadata, TagSummary } from "./types";
import { tagToSlug } from "./utils";

export function aggregateTags(posts: readonly PostMetadata[]): TagSummary[] {
  const tags = new Map<string, TagSummary>();

  for (const post of posts) {
    for (const label of post.tags) {
      const slug = tagToSlug(label);
      const current = tags.get(slug);

      if (current && current.label !== label) {
        throw new Error(`标签“${label}”与“${current.label}”生成了相同 slug：${slug}`);
      }

      tags.set(slug, { label, slug, count: (current?.count ?? 0) + 1 });
    }
  }

  return [...tags.values()].sort(
    (left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-CN"),
  );
}
