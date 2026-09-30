import type { PostMetadata } from "./types";
import { isPostKind } from "./kinds";
import { comparePostsByDate, tagToSlug } from "./utils";

export const POSTS_PAGE_SIZE = 5;
export type PostQuery = Readonly<{ kind?: string; category?: string; tag?: string; page?: string }>;

export function queryPosts(posts: readonly PostMetadata[], query: PostQuery = {}) {
  const kind = isPostKind(query.kind) ? query.kind : undefined;
  const category = query.category || undefined;
  const tag = query.tag || undefined;
  const matches = posts
    .filter(
      (post) =>
        post.published &&
        (!kind || post.kind === kind) &&
        (!category || post.category === category) &&
        (!tag || post.tags.some((label) => tagToSlug(label) === tag)),
    )
    .sort(comparePostsByDate);
  const total = matches.length;
  const pageCount = Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE));
  const requested = query.page && /^\d+$/.test(query.page) ? Number(query.page) : 1;
  const page =
    Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, pageCount) : 1;
  return {
    posts: matches.slice((page - 1) * POSTS_PAGE_SIZE, page * POSTS_PAGE_SIZE),
    total,
    page,
    pageCount,
    kind,
    category,
    tag,
  };
}

export function relatedPosts(posts: readonly PostMetadata[], slug: string): PostMetadata[] {
  const source = posts.find((post) => post.slug === slug && post.published);
  if (!source) return [];
  const tags = new Set(source.tags.map(tagToSlug));
  const seen = new Set([slug]);
  return posts
    .filter((post) => {
      if (!post.published || seen.has(post.slug)) return false;
      seen.add(post.slug);
      return true;
    })
    .map((post) => ({
      post,
      score:
        (post.category === source.category ? 1 : 0) +
        [...new Set(post.tags.map(tagToSlug))].filter((tag) => tags.has(tag)).length * 2,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || comparePostsByDate(a.post, b.post))
    .slice(0, 3)
    .map(({ post }) => post);
}
