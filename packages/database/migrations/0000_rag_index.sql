-- pgvector cannot be declared by the Drizzle TypeScript schema. Keep extension
-- installation in an explicit migration that runs before vector columns/indexes.
CREATE EXTENSION IF NOT EXISTS vector;
