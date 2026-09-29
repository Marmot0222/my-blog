import { createTaskStore, taskSource } from "@ting-lab/database";
import {
  chunkMarkdown,
  createDocumentChecksum,
  createEmbeddingService,
  type EmbeddingConfig,
  type EmbeddingService,
} from "@ting-lab/retrieval";
import { effectiveEmbedding, embeddingFingerprint } from "./config";
import { recordToPost } from "./content";

export async function runNextTask(
  deps: {
    store?: ReturnType<typeof createTaskStore>;
    configuration?: () => Promise<EmbeddingConfig>;
    embedding?: (config: EmbeddingConfig, signal: AbortSignal) => EmbeddingService;
  } = {},
) {
  const store = deps.store ?? createTaskStore(),
    task = await store.claim();
  if (!task) return false;
  try {
    if (task.operation === "remove") {
      await store.finish(task);
      return true;
    }
    const row = await store.read(task);
    if (!row) {
      await store.finish(task);
      return true;
    }
    const config = await (deps.configuration ?? effectiveEmbedding)();
    if (embeddingFingerprint(config) !== task.fingerprint)
      throw new Error("Embedding space mismatch");
    const post = recordToPost(row),
      checksum = createDocumentChecksum(post, config);
    if (await store.indexed(task, checksum)) {
      await store.finish(task, undefined, checksum);
      return true;
    }
    const chunks = chunkMarkdown({ title: post.metadata.title, content: post.content });
    const service = (deps.embedding ?? createEmbeddingService)(
      config,
      AbortSignal.timeout(180_000),
    );
    const vectors = await service.embedMany(chunks.map((chunk) => chunk.content));
    await store.finish(task, {
      document: {
        slug: row.slug,
        title: post.metadata.title,
        description: post.metadata.description,
        category: post.metadata.category,
        publishedAt: post.metadata.date,
        updatedAt: post.metadata.updatedAt,
        contentChecksum: checksum,
        sourcePath: taskSource(task),
        isPublished: true,
      },
      chunks: chunks.map((chunk, index) => ({ ...chunk, embedding: vectors[index] })),
    });
  } catch {
    await store.fail(task);
  }
  return true;
}
