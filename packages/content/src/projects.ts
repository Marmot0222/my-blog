import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { projectFrontMatterSchema } from "./schema";
import type { Project, ProjectMetadata, SearchDocument } from "./types";
import { isSafeSlug } from "./utils";

function formatValidationError(filePath: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`无法解析项目文件 ${filePath}: ${message}`);
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

function parseProjectFile(filePath: string): Project {
  try {
    const parsed = matter(readFileSync(filePath, "utf8"));
    const filename = path.basename(filePath, ".mdx");
    if (!isSafeSlug(filename)) throw new Error("文件名必须是 URL 安全的小写英文 slug");
    const frontMatter = projectFrontMatterSchema.parse(parsed.data);
    if (new Set(frontMatter.stack).size !== frontMatter.stack.length) {
      throw new Error("stack 不允许包含重复项");
    }
    return { metadata: frontMatter, content: parsed.content.trim() };
  } catch (error) {
    throw formatValidationError(filePath, error);
  }
}

export function compareProjects(left: ProjectMetadata, right: ProjectMetadata): number {
  return (
    Number(right.featured) - Number(left.featured) ||
    left.order - right.order ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.slug.localeCompare(right.slug)
  );
}

export function readProjectEntries(projectsDirectory: string | undefined): Project[] {
  if (!projectsDirectory) return [];
  try {
    const entries = readdirSync(projectsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
      .map((entry) => parseProjectFile(path.join(projectsDirectory, entry.name)));
    const slugs = new Set<string>();
    for (const entry of entries) {
      const slug = entry.metadata.slug.toLowerCase();
      if (slugs.has(slug)) throw new Error(`检测到重复项目 slug：${entry.metadata.slug}`);
      slugs.add(slug);
    }
    return entries.sort((left, right) => compareProjects(left.metadata, right.metadata));
  } catch (error) {
    throw formatValidationError(projectsDirectory, error);
  }
}

export function projectToSearchDocument(project: Project): SearchDocument {
  const text = toPlainText(project.content);
  return {
    id: `project:${project.metadata.slug}`,
    type: "project",
    kind: "project",
    title: project.metadata.title,
    description: project.metadata.summary,
    excerpt:
      text.length > 180 ? `${text.slice(0, 179).trimEnd()}…` : text || project.metadata.summary,
    date: project.metadata.updatedAt,
    updatedAt: project.metadata.updatedAt,
    category: "项目",
    tags: project.metadata.stack,
    href: `/projects/${project.metadata.slug}`,
    searchableText: text,
  };
}
