import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicAddress, approvedProviderUrl, createGuardedFetch } from "./outbound";
import { MockLanguageModelV3 } from "ai/test";
import { testAiConnection } from "./connection-test";
test("provider guard rejects private, metadata, credentials and non-approved targets", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "169.254.169.254",
    "192.168.1.2",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "0.0.0.0",
  ])
    assert.throws(() => assertPublicAddress(ip));
  for (const url of [
    "http://api.openai.com/v1",
    "https://x:secret@api.openai.com/v1",
    "https://evil.example/v1",
    "https://api.openai.com:8080",
    "file:///etc/passwd",
    "https://api.openai.com/?secret=x",
  ])
    assert.throws(() => approvedProviderUrl(url, {}));
  assert.equal(approvedProviderUrl("https://api.openai.com/v1", {}).hostname, "api.openai.com");
});
test("actual provider fetch refuses an origin change before network access", async () => {
  const guarded = createGuardedFetch("https://api.openai.com/v1", {});
  await assert.rejects(() => guarded("http://127.0.0.1/secrets"));
});
test("approved hostname still cannot resolve to a private socket", async () => {
  const guarded = createGuardedFetch("https://localhost/v1", { AI_ALLOWED_HOSTS: "localhost" });
  await assert.rejects(() => guarded("https://localhost/v1/chat/completions"));
});
test("connection check uses one bounded fake model request without provider network", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: "OK" }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 4, noCache: 4, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
  await testAiConnection(
    {
      provider: "openai",
      model: "fake",
      apiKey: "fixture-only",
      maxOutputTokens: 1000,
      requestTimeoutMs: 60000,
    },
    model,
  );
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(model.doGenerateCalls[0].maxOutputTokens, 16);
});
