import { parseAiConfig } from "./config";
import { createAiModel } from "./provider";
import { TING_LAB_SYSTEM_PROMPT } from "./prompt";
import type { AiRuntime } from "./types";

export { AiConfigurationError, parseAiConfig } from "./config";
export { normalizeAiError } from "./errors";
export { createAiModel } from "./provider";
export { TING_LAB_SYSTEM_PROMPT } from "./prompt";
export type { AiConfig, AiErrorCode, AiProvider, AiRuntime, PublicAiError } from "./types";

export function createAiRuntime(env: NodeJS.ProcessEnv = process.env): AiRuntime {
  const config = parseAiConfig(env);
  return {
    config,
    model: createAiModel(config),
    systemPrompt: TING_LAB_SYSTEM_PROMPT,
  };
}
