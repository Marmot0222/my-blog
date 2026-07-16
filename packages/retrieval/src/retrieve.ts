import {
  createDatabase,
  DatabaseConfigurationError,
  searchDocumentChunks,
  type TingLabDatabase,
} from "@ting-lab/database";

import { parseEmbeddingConfig, parseRetrievalConfig, EmbeddingConfigurationError } from "./config";
import { buildRagContext, createRagSources } from "./context";
import { createEmbeddingService } from "./embedding";
import type { EmbeddingService, RagResult, RetrievedChunk, RetrievalConfig } from "./types";

export function selectContextChunks(
  rows: readonly RetrievedChunk[],
  config: RetrievalConfig,
): RetrievedChunk[] {
  const perDocument = new Map<string, number>();
  const selected: RetrievedChunk[] = [];
  let characters = 0;
  for (const row of [...rows].sort((a, b) => b.similarity - a.similarity)) {
    if (row.similarity < config.similarityThreshold) continue;
    const count = perDocument.get(row.documentSlug) ?? 0;
    if (count >= 2 || characters + row.content.length > config.maxContextChars) continue;
    selected.push(row);
    perDocument.set(row.documentSlug, count + 1);
    characters += row.content.length;
    if (selected.length >= config.topK) break;
  }
  return selected;
}

export async function retrieveRelevantChunks(
  options: Readonly<{
    query: string;
    config: RetrievalConfig;
    embedding: EmbeddingService;
    db: TingLabDatabase;
    search?: typeof searchDocumentChunks;
  }>,
): Promise<RagResult> {
  const queryEmbedding = await options.embedding.embedOne(options.query);
  const rows = await (options.search ?? searchDocumentChunks)(options.db, queryEmbedding, {
    limit: options.config.topK * 3,
    similarityThreshold: options.config.similarityThreshold,
  });
  const chunks = selectContextChunks(rows, options.config);
  if (chunks.length === 0) {
    return { status: { status: "no_match", sourceCount: 0 }, sources: [], chunks: [], context: "" };
  }
  const sources = createRagSources(chunks);
  return {
    status: { status: "used", sourceCount: sources.length },
    sources,
    chunks,
    context: buildRagContext(chunks, sources, options.config.maxContextChars),
  };
}

export async function retrieveBlogKnowledge(
  query: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<RagResult> {
  try {
    const embeddingConfig = parseEmbeddingConfig(env);
    const retrievalConfig = parseRetrievalConfig(env);
    const database = createDatabase(env);
    return await retrieveRelevantChunks({
      query,
      config: retrievalConfig,
      embedding: createEmbeddingService(embeddingConfig),
      db: database.db,
    });
  } catch (error) {
    const notConfigured =
      error instanceof EmbeddingConfigurationError || error instanceof DatabaseConfigurationError;
    console.warn(
      notConfigured ? "RAG 未配置，本次使用通用对话。" : "RAG 检索不可用，本次使用通用对话。",
    );
    return {
      status: {
        status: "unavailable",
        sourceCount: 0,
        reason: notConfigured ? "not_configured" : "retrieval_error",
      },
      sources: [],
      chunks: [],
      context: "",
    };
  }
}
