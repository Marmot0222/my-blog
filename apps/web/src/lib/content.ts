import path from "node:path";

import { createContentRepository } from "@ting-lab/content";

const postsDirectory =
  process.env.CONTENT_ROOT ?? path.resolve(process.cwd(), "../../content/posts");

export const contentRepository = createContentRepository({ postsDirectory });
