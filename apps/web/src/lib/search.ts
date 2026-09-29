import { createContentSearchIndex } from "@ting-lab/content";

import { getContentRepository } from "./content";

export async function getSiteSearchIndex() {
  return createContentSearchIndex((await getContentRepository()).getSearchDocuments());
}
