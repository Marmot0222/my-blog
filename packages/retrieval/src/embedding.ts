import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

import type { EmbeddingConfig, EmbeddingService } from "./types";

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status =
    "statusCode" in error ? error.statusCode : "status" in error ? error.status : undefined;
  const code = "code" in error ? error.code : undefined;
  const name = "name" in error ? error.name : undefined;
  return (
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    name === "AbortError" ||
    name === "TimeoutError"
  );
}

async function retry<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxRetries || !isRetryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      attempt += 1;
    }
  }
}

export function validateEmbeddings(embeddings: readonly number[][], expectedCount: number): void {
  if (embeddings.length !== expectedCount) throw new Error("Embedding 返回数量与输入不一致");
  for (const [index, vector] of embeddings.entries()) {
    if (vector.length !== 1536) {
      throw new Error(
        `Embedding 维度不匹配：第 ${index + 1} 条期望 1536 维，实际 ${vector.length} 维`,
      );
    }
    if (vector.some((value) => !Number.isFinite(value))) {
      throw new Error(`Embedding 包含非有限数值：第 ${index + 1} 条`);
    }
  }
}

export function createEmbeddingProviderOptions(dimensions: number) {
  return {
    openai: {
      dimensions,
    },
  } as const;
}

export function createEmbeddingService(config: EmbeddingConfig): EmbeddingService {
  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    name: `embedding-${config.provider}`,
  });
  const model = provider.embeddingModel(config.model);
  const providerOptions = createEmbeddingProviderOptions(config.dimensions);

  return {
    async embedMany(values) {
      const embeddings: number[][] = [];
      for (let offset = 0; offset < values.length; offset += config.batchSize) {
        const batch = values.slice(offset, offset + config.batchSize);
        const startedAt = Date.now();
        const result = await retry(
          () => embedMany({ model, values: [...batch], maxRetries: 0, providerOptions }),
          config.maxRetries,
        );
        validateEmbeddings(result.embeddings, batch.length);
        embeddings.push(...result.embeddings);
        console.info(
          `Embedding 批次 ${Math.floor(offset / config.batchSize) + 1}: ${batch.length} 条，${Date.now() - startedAt}ms`,
        );
      }
      return embeddings;
    },
    async embedOne(value) {
      const result = await retry(
        () => embed({ model, value, maxRetries: 0, providerOptions }),
        config.maxRetries,
      );
      validateEmbeddings([result.embedding], 1);
      return result.embedding;
    },
  };
}
