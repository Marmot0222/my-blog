import assert from "node:assert/strict";
import test from "node:test";

import { EmbeddingConfigurationError, parseEmbeddingConfig } from "./config";
import { createEmbeddingProviderOptions, validateEmbeddings } from "./embedding";

const vector = () => Array.from({ length: 1024 }, () => 0);

test("Embedding 配置与聊天配置解耦并固定 1024 维", () => {
  const config = parseEmbeddingConfig({
    EMBEDDING_PROVIDER: "openai-compatible",
    EMBEDDING_MODEL: "embed",
    EMBEDDING_DIMENSIONS: "1024",
    EMBEDDING_API_KEY: "fixture",
    EMBEDDING_BASE_URL: "https://example.com/v1",
  });
  assert.equal(config.dimensions, 1024);
  assert.equal(config.provider, "openai-compatible");
  const reused = parseEmbeddingConfig({
    EMBEDDING_PROVIDER: "openai-compatible",
    EMBEDDING_MODEL: "embed",
    EMBEDDING_DIMENSIONS: "1024",
    OPENAI_COMPATIBLE_API_KEY: "fixture",
    OPENAI_BASE_URL: "https://chat-compatible.example/v1",
  });
  assert.equal(reused.baseURL, "https://chat-compatible.example/v1");
  const officialOpenAi = parseEmbeddingConfig({
    EMBEDDING_PROVIDER: "openai",
    EMBEDDING_MODEL: "text-embedding-3-small",
    EMBEDDING_DIMENSIONS: "1024",
    EMBEDDING_API_KEY: "fixture",
    OPENAI_BASE_URL: "https://chat-compatible.example/v1",
  });
  assert.equal(officialOpenAi.baseURL, undefined);
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
  assert.throws(() => validateEmbeddings([[0, 1]], 1), /期望 1024 维，实际 2 维/);
  const invalid = vector();
  invalid[10] = Number.NaN;
  assert.throws(() => validateEmbeddings([invalid], 1), /有限/);
});

test("仅向官方 OpenAI 接口显式请求数据库固定的向量维度", () => {
  assert.deepEqual(createEmbeddingProviderOptions({ provider: "openai", dimensions: 1024 }), {
    openai: { dimensions: 1024 },
  });
  assert.equal(
    createEmbeddingProviderOptions({ provider: "openai-compatible", dimensions: 1024 }),
    undefined,
  );
});
