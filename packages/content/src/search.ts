import type { ContentSearchIndex, SearchDocument, SearchOptions, SearchResult } from "./types";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryTerms(query: string): string[] {
  return [...new Set(normalizeSearchText(query).split(" ").filter(Boolean))];
}

function countMatches(value: string, term: string): number {
  let count = 0;
  let offset = 0;
  while ((offset = value.indexOf(term, offset)) !== -1) {
    count += 1;
    offset += term.length;
  }
  return count;
}

function scoreDocument(document: SearchDocument, terms: readonly string[]): number | undefined {
  const fields = [
    [normalizeSearchText(document.title), 12],
    [normalizeSearchText(document.tags.join(" ")), 8],
    [normalizeSearchText(document.category), 6],
    [normalizeSearchText(document.description), 4],
    [normalizeSearchText(document.searchableText), 1],
  ] as const;

  let score = 0;
  for (const term of terms) {
    let termScore = 0;
    for (const [value, weight] of fields) {
      termScore += Math.min(countMatches(value, term), 3) * weight;
    }
    if (termScore === 0) return undefined;
    score += termScore;
  }
  return score;
}

function toResult(document: SearchDocument): SearchResult {
  return {
    id: document.id,
    type: document.type,
    kind: document.kind,
    title: document.title,
    description: document.description,
    excerpt: document.excerpt,
    date: document.date,
    updatedAt: document.updatedAt,
    category: document.category,
    tags: document.tags,
    href: document.href,
  };
}

export function createContentSearchIndex(documents: readonly SearchDocument[]): ContentSearchIndex {
  const immutableDocuments = documents.map((document) => Object.freeze({ ...document }));

  return {
    search(query: string, options: SearchOptions = {}): SearchResult[] {
      const terms = queryTerms(query);
      if (terms.length === 0) return [];

      const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(options.limit ?? DEFAULT_LIMIT)));
      return immutableDocuments
        .map((document) => ({ document, score: scoreDocument(document, terms) }))
        .filter(
          (entry): entry is { document: SearchDocument; score: number } =>
            entry.score !== undefined,
        )
        .sort(
          (left, right) =>
            right.score - left.score ||
            right.document.date.localeCompare(left.document.date) ||
            left.document.title.localeCompare(right.document.title, "zh-CN") ||
            left.document.href.localeCompare(right.document.href),
        )
        .slice(0, limit)
        .map(({ document }) => toResult(document));
    },
  };
}
