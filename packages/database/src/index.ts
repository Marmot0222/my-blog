export {
  buildDatabase,
  createDatabase,
  createDatabaseAccessor,
  createIsolatedDatabase,
  withIsolatedDatabase,
  type DatabaseRuntimeFactory,
} from "./client";
export { DatabaseConfigurationError, parseDatabaseConfig } from "./config";
export { deleteDocumentIndexes, listDocumentStates, replaceDocumentIndex } from "./documents";
export { documentChunks, documents } from "./schema";
export { searchDocumentChunks } from "./search";
export { EMBEDDING_DIMENSIONS } from "./types";
export type {
  ChunkSearchResult,
  DatabaseRuntime,
  DocumentState,
  IndexedChunk,
  IndexedDocument,
  TingLabDatabase,
} from "./types";
