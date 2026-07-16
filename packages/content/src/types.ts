export type PostKind = "article" | "note";

export type PostVisual = "interface" | "system" | "code";

export type PostMetadata = Readonly<{
  slug: string;
  title: string;
  description: string;
  date: string;
  updatedAt?: string;
  tags: string[];
  category: string;
  published: boolean;
  featured: boolean;
  kind: PostKind;
  visual?: PostVisual;
  readingTime: string;
}>;

export type Post = Readonly<{
  metadata: PostMetadata;
  content: string;
}>;

export type TagSummary = Readonly<{
  label: string;
  slug: string;
  count: number;
}>;

export type ContentRepository = Readonly<{
  getAllPosts(): PostMetadata[];
  getPublishedPosts(): PostMetadata[];
  getFeaturedPosts(): PostMetadata[];
  getLatestNotes(): PostMetadata[];
  getPostBySlug(slug: string): Post | undefined;
  getAllPostSlugs(): string[];
  getAllTags(): TagSummary[];
  getPostsByTag(tagSlug: string): PostMetadata[];
  validate(): PostMetadata[];
}>;
