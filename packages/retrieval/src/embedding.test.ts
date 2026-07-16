import assert from "node:assert/strict";
import test from "node:test";

import { EmbeddingConfigurationError, parseEmbeddingConfig } from "./config";
import { validateEmbeddings } from "./embedding";

const vector = () => Array.from({ length: 1536 }, () => 0);

test("Embedding 配置与聊天配置解耦并固定 1536 维", () => {
  const config = parseEmbeddingConfig({
    EMBEDDING_PROVIDER: "openai-compatible",
    EMBEDDING_MODEL: "embed",
    EMBEDDING_DIMENSIONS: "1536",
    EMBEDDING_API_KEY: "fixture",
    EMBEDDING_BASE_URL: "https://example.com/v1",
  });
  assert.equal(config.dimensions, 1536);
  assert.equal(config.provider, "openai-compatible");
  const reused = parseEmbeddingConfig({
    EMBEDDING_PROVIDER: "openai-compatible",
    EMBEDDING_MODEL: "embed",
    EMBEDDING_DIMENSIONS: "1536",
    OPENAI_COMPATIBLE_API_KEY: "fixture",
    OPENAI_BASE_URL: "https://chat-compatible.example/v1",
  });
  assert.equal(reused.baseURL, "https://chat-compatible.example/v1");
  assert.throws(
    () =>
      parseEmbeddingConfig({
        ...process.env,
        EMBEDDING_PROVIDER: "openai",
        EMBEDDING_MODEL: "x",
        EMBEDDING_DIMENSIONS: "768",
      }),
    EmbeddingConfigurationError,
  );
});

test("验证 Embedding 数量、维度与有限数值", () => {
  assert.doesNotThrow(() => validateEmbeddings([vector(), vector()], 2));
  assert.throws(() => validateEmbeddings([vector()], 2), /数量/);
  assert.throws(() => validateEmbeddings([[0, 1]], 1), /1536/);
  const invalid = vector();
  invalid[10] = Number.NaN;
  assert.throws(() => validateEmbeddings([invalid], 1), /有限/);
});
