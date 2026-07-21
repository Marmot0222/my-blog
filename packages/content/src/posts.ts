import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import readingTime from "reading-time";

import { postFrontMatterSchema } from "./schema";
import { projectToSearchDocument, readProjectEntries } from "./projects";
import { aggregateTags } from "./tags";
import type { ContentRepository, Post, PostMetadata, SearchDocument } from "./types";
import { comparePostsByDate, isSafeSlug, tagToSlug } from "./utils";

export type ContentRepositoryOptions = Readonly<{
  postsDirectory: string;
  projectsDirectory?: string;
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

function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replace(/[`*_>#~|{}()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createExcerpt(content: string, fallback: string): string {
  const plainText = toPlainText(content) || fallback;
  return plainText.length > 180 ? `${plainText.slice(0, 179).trimEnd()}…` : plainText;
}

export function createContentRepository({
  postsDirectory,
  projectsDirectory,
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

  function getAllProjectEntries() {
    return readProjectEntries(projectsDirectory);
  }

  function getAllProjects() {
    return getAllProjectEntries().map((project) => project.metadata);
  }

  function getPublishedProjects() {
    return getAllProjects().filter((project) => project.published);
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
    getAllProjects,
    getPublishedProjects,
    getFeaturedProjects: () => getPublishedProjects().filter((project) => project.featured),
    getProjectBySlug: (slug) => {
      if (!isSafeSlug(slug)) return undefined;
      return getAllProjectEntries().find((project) => project.metadata.slug === slug);
    },
    getAllProjectSlugs: () => getPublishedProjects().map((project) => project.slug),
    getSearchDocuments: () =>
      [
        ...getAllPostEntries()
          .filter(({ metadata }) => metadata.published)
          .map(({ metadata, content }): SearchDocument => ({
            id: metadata.slug,
            type: "post",
            kind: metadata.kind,
            title: metadata.title,
            description: metadata.description,
            excerpt: createExcerpt(content, metadata.description),
            date: metadata.date,
            updatedAt: metadata.updatedAt,
            category: metadata.category,
            tags: metadata.tags,
            href: `/posts/${metadata.slug}`,
            searchableText: toPlainText(content),
          })),
        ...getAllProjectEntries()
          .filter(({ metadata }) => metadata.published)
          .map(projectToSearchDocument),
      ].sort(
        (left, right) => right.date.localeCompare(left.date) || left.id.localeCompare(right.id),
      ),
    validate: getAllPosts,
    validateProjects: getAllProjects,
  };
}
