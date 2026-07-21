import path from "node:path";

import { createContentRepository } from "@ting-lab/content";

const contentRoot = process.env.CONTENT_ROOT ?? path.resolve(process.cwd(), "../../content");

export const contentRepository = createContentRepository({
  postsDirectory: path.join(contentRoot, "posts"),
  projectsDirectory: path.join(contentRoot, "projects"),
});
