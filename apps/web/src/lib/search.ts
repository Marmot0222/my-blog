import { createContentSearchIndex } from "@ting-lab/content";

import { contentRepository } from "./content";

export const siteSearchIndex = createContentSearchIndex(contentRepository.getSearchDocuments());
