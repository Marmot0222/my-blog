import path from "node:path";

import { createContentRepository } from "./posts";

const directoryArgument = process.argv[2];

if (!directoryArgument) {
  console.error("请提供 content 根目录路径。");
  process.exitCode = 1;
} else {
  try {
    const contentDirectory = path.resolve(process.cwd(), directoryArgument);
    const repository = createContentRepository({
      postsDirectory: path.join(contentDirectory, "posts"),
      projectsDirectory: path.join(contentDirectory, "projects"),
    });
    const posts = repository.validate();
    const projects = repository.validateProjects();
    repository.getAllTags();
    console.log(`内容校验通过：${posts.length} 篇文章，${projects.length} 个项目。`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
