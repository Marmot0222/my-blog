import assert from "node:assert/strict";
import test from "node:test";

import { APICallError } from "ai";

import { AiConfigurationError, parseAiConfig } from "./config";
import { normalizeAiError } from "./errors";

const base = {
  AI_MODEL: "test-model",
  AI_MAX_OUTPUT_TOKENS: "1200",
  AI_REQUEST_TIMEOUT_MS: "60000",
};

test("解析 OpenAI 配置", () => {
  const config = parseAiConfig({ ...base, AI_PROVIDER: "openai", OPENAI_API_KEY: "test-key" });
  assert.equal(config.provider, "openai");
  assert.equal(config.apiKey, "test-key");
});

test("解析 Google 配置", () => {
  const config = parseAiConfig({
    ...base,
    AI_PROVIDER: "google",
    GOOGLE_GENERATIVE_AI_API_KEY: "google-test-key",
  });
  assert.equal(config.provider, "google");
});

test("解析 OpenAI-compatible 配置", () => {
  const config = parseAiConfig({
    ...base,
    AI_PROVIDER: "openai-compatible",
    OPENAI_BASE_URL: "https://example.com/v1",
    OPENAI_COMPATIBLE_API_KEY: "compatible-test-key",
  });
  assert.equal(config.baseURL, "https://example.com/v1");
});

test("缺少供应商 Key 时失败", () => {
  assert.throws(() => parseAiConfig({ ...base, AI_PROVIDER: "openai" }), AiConfigurationError);
});

test("非法 baseURL、token 和 timeout 越界时失败", () => {
  const invalidValues = [
    { OPENAI_BASE_URL: "not-a-url" },
    { OPENAI_BASE_URL: "ftp://example.com/v1" },
    { AI_MAX_OUTPUT_TOKENS: "9000" },
    { AI_REQUEST_TIMEOUT_MS: "100" },
  ];

  for (const invalid of invalidValues) {
    assert.throws(
      () =>
        parseAiConfig({
          ...base,
          AI_PROVIDER: "openai-compatible",
          OPENAI_BASE_URL: "https://example.com/v1",
          OPENAI_COMPATIBLE_API_KEY: "secret-test-key",
          ...invalid,
        }),
      AiConfigurationError,
    );
  }
});

test("公共错误不会泄露 Key 或上游响应", () => {
  const secret = "test-key-that-must-not-leak";
  const error = new APICallError({
    message: `authentication failed: ${secret}`,
    url: "https://example.com/v1/chat",
    requestBodyValues: { apiKey: secret },
    responseBody: secret,
    statusCode: 401,
  });
  const publicError = normalizeAiError(error);

  assert.equal(publicError.code, "UPSTREAM_AUTH_ERROR");
  assert.doesNotMatch(JSON.stringify(publicError), new RegExp(secret));
});
