import type { PublicRagSource, RagStatus } from "@ting-lab/retrieval";
import type { UIMessage } from "ai";

export type ChatDataParts = {
  ragStatus: RagStatus;
  sources: PublicRagSource[];
};

export type TingLabUIMessage = UIMessage<never, ChatDataParts>;
