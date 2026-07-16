import assert from "node:assert/strict";
import test from "node:test";

import { APICallError } from "ai";

import { chatErrorResponse, parseClientChatError, toPublicChatError } from "./errors";

test("公共错误映射不包含上游正文", async () => {
  const secret = "provider-secret";
  const publicError = toPublicChatError(
    new APICallError({
      message: secret,
      url: "https://example.com",
      requestBodyValues: secret,
      responseBody: secret,
      statusCode: 429,
    }),
  );
  const response = chatErrorResponse(publicError, 502);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.doesNotMatch(await response.text(), new RegExp(secret));
});

test("客户端只解析稳定错误字段", () => {
  const parsed = parseClientChatError(
    new Error(
      JSON.stringify({
        code: "AI_NOT_CONFIGURED",
        message: "AI 服务尚未配置，请稍后再试。",
        retryable: false,
      }),
    ),
  );
  assert.equal(parsed.code, "AI_NOT_CONFIGURED");
  assert.equal(parsed.retryable, false);
});
