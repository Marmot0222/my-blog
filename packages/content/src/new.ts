import { fileURLToPath } from "node:url";
import { createPostDraft } from "./new-post";

try {
  if (process.env.CONTENT_SOURCE === "database")
    throw new Error("database 模式请访问 /admin/posts/new 新建草稿；文件不会同步到数据库。");
  const target = createPostDraft(
    fileURLToPath(new URL("../../../content/posts/", import.meta.url)),
    process.argv.slice(2),
  );
  console.log(
    `已创建草稿：${target}\n请编辑正文和 Front Matter，运行 pnpm content:check。\n本地设置 CONTENT_PREVIEW=1 后运行 pnpm dev，访问 /preview/posts/<slug>。\n发布前检查日期、摘要和标签，再将 published 改为 true。`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "创建草稿失败");
  process.exitCode = 1;
}
