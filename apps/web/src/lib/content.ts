import path from "node:path";

import { createContentRepository } from "@ting-lab/content";
import { contentSource, getContentSnapshot } from "@ting-lab/publishing";
import { connection } from "next/server";
import { cache } from "react";

const contentRoot = process.env.CONTENT_ROOT ?? path.resolve(process.cwd(), "../../content");

const options = {
  postsDirectory: path.join(contentRoot, "posts"),
  projectsDirectory: path.join(contentRoot, "projects"),
};
// Project routes and development-only file previews keep their file adapter.
export const contentRepository = createContentRepository(options);
export const getContentRepository = cache(async () => {
  if (contentSource() === "database") await connection();
  return getContentSnapshot(options);
});
