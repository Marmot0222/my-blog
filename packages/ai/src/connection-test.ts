import { generateText, type LanguageModel } from "ai";
import { createAiModel } from "./provider";
import type { AiConfig } from "./types";
export async function testAiConnection(
  config: AiConfig,
  model: LanguageModel = createAiModel(config),
) {
  await generateText({
    model,
    prompt: "Reply with OK.",
    maxOutputTokens: 16,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(10_000),
  });
}
