import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";

import { postFrontMatterSchema } from "./schema";
import { aggregateTags } from "./tags";
import type { ContentRepository, Post, PostMetadata } from "./types";
import { comparePostsByDate, isSafeSlug, tagToSlug } from "./utils";

export type ContentRepositoryOptions = Readonly<{
  postsDirectory: string;
}>;

function formatValidationError(filePath: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`无法解析内容文件 ${filePath}: ${message}`);
}

function parsePostFile(filePath: string): Post {
  try {
    const source = readFileSync(filePath, "utf8");
    const parsed = matter(source);
    const slug = path.basename(filePath, ".mdx");

    if (!isSafeSlug(slug)) {
      throw new Error("文件名必须是 URL 安全的小写英文 slug");
    }

    if (Object.hasOwn(parsed.data, "slug")) {
      throw new Error("slug 必须来自文件名，Front Matter 不允许声明 slug");
    }

    const frontMatter = postFrontMatterSchema.parse(parsed.data);
    const reading = readingTime(parsed.content);
    const metadata: PostMetadata = {
      slug,
      ...frontMatter,
      readingTime: `约 ${Math.max(1, Math.ceil(reading.minutes))} 分钟阅读`,
    };

    for (const tag of metadata.tags) {
      tagToSlug(tag);
    }

    if (metadata.featured && !metadata.visual) {
      throw new Error("featured 内容必须配置 visual");
    }

    return { metadata, content: parsed.content.trim() };
  } catch (error) {
    throw formatValidationError(filePath, error);
  }
}

export function createContentRepository({
  postsDirectory,
}: ContentRepositoryOptions): ContentRepository {
  function getPostFiles(): string[] {
    try {
      return readdirSync(postsDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
        .map((entry) => path.join(postsDirectory, entry.name))
        .sort();
    } catch (error) {
      throw formatValidationError(postsDirectory, error);
    }
  }

  function getAllPostEntries(): Post[] {
    const entries = getPostFiles().map(parsePostFile);
    const slugs = new Set<string>();

    for (const entry of entries) {
      const normalizedSlug = entry.metadata.slug.toLowerCase();
      if (slugs.has(normalizedSlug)) {
        throw new Error(`检测到重复文章 slug：${entry.metadata.slug}`);
      }
      slugs.add(normalizedSlug);
    }

    return entries;
  }

  function getAllPosts(): PostMetadata[] {
    return getAllPostEntries()
      .map((post) => post.metadata)
      .sort(comparePostsByDate);
  }

  function getPublishedPosts(): PostMetadata[] {
    return getAllPosts().filter((post) => post.published);
  }

  return {
    getAllPosts,
    getPublishedPosts,
    getFeaturedPosts: () => getPublishedPosts().filter((post) => post.featured),
    getLatestNotes: () => getPublishedPosts().filter((post) => post.kind === "note"),
    getPostBySlug: (slug) => {
      if (!isSafeSlug(slug)) {
        return undefined;
      }
      return getAllPostEntries().find((post) => post.metadata.slug === slug);
    },
    getAllPostSlugs: () => getPublishedPosts().map((post) => post.slug),
    getAllTags: () => aggregateTags(getPublishedPosts()),
    getPostsByTag: (tagSlug) =>
      getPublishedPosts().filter((post) => post.tags.some((tag) => tagToSlug(tag) === tagSlug)),
    validate: getAllPosts,
  };
}
