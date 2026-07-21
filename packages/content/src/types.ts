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

export type SearchDocument = Readonly<{
  id: string;
  type: "post";
  kind: PostKind;
  title: string;
  description: string;
  excerpt: string;
  date: string;
  updatedAt?: string;
  category: string;
  tags: readonly string[];
  href: string;
  searchableText: string;
}>;

export type SearchResult = Omit<SearchDocument, "searchableText">;

export type SearchOptions = Readonly<{
  limit?: number;
}>;

export type ContentSearchIndex = Readonly<{
  search(query: string, options?: SearchOptions): SearchResult[];
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
  getSearchDocuments(): SearchDocument[];
  validate(): PostMetadata[];
}>;
