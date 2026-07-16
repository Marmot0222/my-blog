import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import type { AiConfig } from "./types";

export function createAiModel(config: AiConfig): LanguageModel {
  if (config.provider === "google") {
    return createGoogleGenerativeAI({ apiKey: config.apiKey }).languageModel(config.model);
  }

  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    name: config.provider,
  });

  // Chat Completions is the widest common subset for explicitly configured
  // OpenAI-compatible endpoints. The official OpenAI provider uses it as well.
  return provider.chat(config.model);
}
