import { createAiModel, TING_LAB_SYSTEM_PROMPT } from "@ting-lab/ai";
import { createDatabase, createTaskStore } from "@ting-lab/database";
import {
  createEmbeddingService,
  parseRetrievalConfig,
  retrieveRelevantChunks,
  retrieveBlogKnowledge,
  type RagResult,
} from "@ting-lab/retrieval";
import { effectiveChat, effectiveEmbedding, embeddingFingerprint } from "./config";
import { contentSource } from "./content";
export async function createPublishingAiRuntime() {
  const config = await effectiveChat();
  // Snapshot configuration once before streaming; activation affects the next request.
  const embedding =
    contentSource() === "database" ? await effectiveEmbedding().catch(() => undefined) : undefined;
  return {
    config,
    model: createAiModel(config),
    systemPrompt: TING_LAB_SYSTEM_PROMPT,
    retrieve: async (query: string): Promise<RagResult> => {
      if (contentSource() === "file") return retrieveBlogKnowledge(query);
      try {
        if (!embedding) throw new Error("Embedding unavailable");
        const database = createDatabase();
        return await retrieveRelevantChunks({
          query,
          config: parseRetrievalConfig(process.env),
          embedding: createEmbeddingService(embedding),
          db: database.db,
          search: (_db, vector, options) =>
            createTaskStore(database).search(vector, options, embeddingFingerprint(embedding)),
        });
      } catch {
        return {
          status: { status: "unavailable", sourceCount: 0, reason: "retrieval_error" },
          sources: [],
          chunks: [],
          context: "",
        };
      }
    },
  };
}
