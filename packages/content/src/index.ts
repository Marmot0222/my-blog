export { createContentRepository, type ContentRepositoryOptions } from "./posts";
export {
  postFrontMatterSchema,
  projectFrontMatterSchema,
  type PostFrontMatter,
  type ProjectFrontMatter,
} from "./schema";
export { compareProjects } from "./projects";
export { createContentSearchIndex, normalizeSearchText } from "./search";
export { aggregateTags } from "./tags";
export type {
  ContentRepository,
  ContentSearchIndex,
  Post,
  PostKind,
  PostMetadata,
  PostVisual,
  Project,
  ProjectMetadata,
  ProjectStatus,
  SearchDocument,
  SearchOptions,
  SearchResult,
  TagSummary,
} from "./types";
export { isSafeSlug, tagToSlug } from "./utils";
