import path from "node:path";
import { createDatabase } from "@ting-lab/database";
import { getContentSnapshot } from "../src/content";

async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_test"))
    throw new Error("Only an isolated local *_test database is allowed");
  process.env.DATABASE_URL = url.href;
  process.env.CONTENT_SOURCE = "database";
  process.env.CONTENT_TIMING = "1";
  const runtime = createDatabase();
  try {
    for (let sample = 0; sample < 5; sample++) {
      const started = performance.now();
      const repository = await getContentSnapshot({
        postsDirectory: path.resolve("content/posts"),
        projectsDirectory: path.resolve("content/projects"),
      });
      const posts = repository.getPublishedPosts();
      console.log(
        JSON.stringify({ sample, count: posts.length, snapshotMs: performance.now() - started }),
      );
    }
  } finally {
    await runtime.close();
  }
}
main().catch(() => {
  console.error("Isolated database measurement unavailable");
  process.exitCode = 1;
});
