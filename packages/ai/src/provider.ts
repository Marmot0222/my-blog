import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import type { AiConfig } from "./types";
import { createGuardedFetch } from "./outbound";

export function createAiModel(config: AiConfig): LanguageModel {
  const baseURL =
    config.baseURL ??
    (config.provider === "google"
      ? "https://generativelanguage.googleapis.com/v1beta"
      : "https://api.openai.com/v1");
  const guardedFetch = createGuardedFetch(baseURL);
  if (config.provider === "google") {
    return createGoogleGenerativeAI({
      apiKey: config.apiKey,
      baseURL,
      fetch: guardedFetch,
    }).languageModel(config.model);
  }

  const provider = createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    name: config.provider,
    fetch: guardedFetch,
  });

  // Chat Completions is the widest common subset for explicitly configured
  // OpenAI-compatible endpoints. The official OpenAI provider uses it as well.
  return provider.chat(config.model);
}
