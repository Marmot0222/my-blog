export type EmbeddingProvider = "openai" | "openai-compatible";

export type EmbeddingConfig = Readonly<{
  provider: EmbeddingProvider;
  model: string;
  dimensions: 1536;
  apiKey: string;
  baseURL?: string;
  batchSize: number;
  maxRetries: number;
}>;

export type RetrievalConfig = Readonly<{
  topK: number;
  similarityThreshold: number;
  maxContextChars: number;
}>;

export type ContentChunk = Readonly<{
  chunkIndex: number;
  heading?: string;
  anchor?: string;
  content: string;
  contentHash: string;
  tokenCount: number;
}>;

export type RetrievedChunk = Readonly<{
  chunkId: string;
  documentSlug: string;
  title: string;
  heading?: string;
  anchor?: string;
  content: string;
  similarity: number;
}>;

export type RagSource = Readonly<{
  id: string;
  index: number;
  title: string;
  heading?: string;
  url: string;
  similarity: number;
}>;

export type PublicRagSource = Omit<RagSource, "similarity">;

export type RagStatus = Readonly<{
  status: "used" | "no_match" | "unavailable";
  sourceCount: number;
  reason?: "not_configured" | "retrieval_error";
}>;

export type RagResult = Readonly<{
  status: RagStatus;
  sources: RagSource[];
  chunks: RetrievedChunk[];
  context: string;
}>;

export type EmbeddingService = Readonly<{
  embedMany(values: readonly string[]): Promise<number[][]>;
  embedOne(value: string): Promise<number[]>;
}>;
