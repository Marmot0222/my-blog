import {
  buildRagSystemAddon,
  retrieveBlogKnowledge,
  type PublicRagSource,
  type RagResult,
} from "@ting-lab/retrieval";

import type { TingLabUIMessage } from "./types";

export type RetrieveKnowledge = (query: string) => Promise<RagResult>;

export function getLastUserQuestion(messages: readonly TingLabUIMessage[]): string {
  const message = [...messages].reverse().find((entry) => entry.role === "user");
  return (
    message?.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim() ?? ""
  );
}

export function toPublicSources(result: RagResult): PublicRagSource[] {
  return result.sources.map((source) => ({
    id: source.id,
    index: source.index,
    title: source.title,
    ...(source.heading ? { heading: source.heading } : {}),
    url: source.url,
  }));
}

export async function prepareChatRag(
  messages: readonly TingLabUIMessage[],
  retrieve: RetrieveKnowledge = retrieveBlogKnowledge,
): Promise<Readonly<{ result: RagResult; systemAddon: string; sources: PublicRagSource[] }>> {
  const question = getLastUserQuestion(messages);
  const result = await retrieve(question);
  return { result, systemAddon: buildRagSystemAddon(result), sources: toPublicSources(result) };
}
