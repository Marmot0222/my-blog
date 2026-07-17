-- The retrieval tables are a rebuildable projection of repository MDX. Clear
-- them before changing dimensions so no 1024-dimension rows are cast to 2048.
DELETE FROM "documents";
--> statement-breakpoint
DROP INDEX "document_chunks_embedding_hnsw_idx";--> statement-breakpoint
ALTER TABLE "document_chunks" ALTER COLUMN "embedding" SET DATA TYPE halfvec(2048);--> statement-breakpoint
CREATE INDEX "document_chunks_embedding_hnsw_idx" ON "document_chunks" USING hnsw ("embedding" halfvec_cosine_ops);
