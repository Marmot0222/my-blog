import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDatabase } from "@ting-lab/database";
import { contentSource } from "./content";
import { runNextTask } from "./index-task";
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
try {
  while (!stopped) {
    await writeFile(path.join(tmpdir(), "ting-lab-worker-health"), String(Date.now()));
    try {
      if (contentSource() === "database" && (await runNextTask())) continue;
    } catch {
      console.warn("索引任务暂不可用，稍后重试。");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
} finally {
  if (contentSource() === "database") await createDatabase().close();
}
