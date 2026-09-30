import path from "node:path";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createContentRepository } from "@ting-lab/content";
import {
  createDatabase,
  createPublishingStore,
  createTaskStore,
  createProfileStore,
} from "@ting-lab/database";
import {
  indexPublishedPosts,
  parseEmbeddingConfig,
  createEmbeddingService,
  parseRetrievalConfig,
  retrieveRelevantChunks,
  retrieveBlogKnowledge,
} from "@ting-lab/retrieval";
import { hashPassword } from "./secrets";
import { contentSource, parseDraft } from "./content";
import { prepareMedia } from "@ting-lab/media/client";
import {
  freezeEmbedding,
  publishFingerprint,
  rotateEnvelope,
  effectiveEmbedding,
  embeddingFingerprint,
} from "./config";
const args = process.argv.slice(2).filter((value) => value !== "--"),
  command = args[0];
const contentRoot = process.env.CONTENT_ROOT ?? path.resolve(process.cwd(), "../../content");
try {
  if (command === "secrets") {
    const target = path.resolve(args[1] ?? ".env.admin-secrets");
    writeFileSync(
      target,
      `ADMIN_SESSION_SECRET=${randomBytes(48).toString("base64")}\nCONFIG_MASTER_KEY=${randomBytes(32).toString("base64")}\nCONFIG_KEY_VERSION=1\n`,
      { flag: "wx", mode: 0o600 },
    );
    console.info("已写入新的秘密文件；请离线备份，不要提交 Git。");
  } else if (command === "password") {
    if (!process.env.ADMIN_PASSWORD)
      throw new Error("请通过 ADMIN_PASSWORD 安全注入密码，不接受命令行密码参数");
    const updated = await createPublishingStore().setPassword(
      await hashPassword(process.env.ADMIN_PASSWORD),
      args.includes("--if-missing"),
    );
    delete process.env.ADMIN_PASSWORD;
    console.info(updated ? "管理员密码已更新，旧会话已撤销。" : "管理员已存在，保留密码和会话。");
  } else if (command === "freeze-embedding") {
    await freezeEmbedding(true);
    console.info("Embedding 配置已冻结。");
  } else if (command === "rotate-master") {
    if (!process.env.NEXT_CONFIG_MASTER_KEY || !process.env.NEXT_CONFIG_KEY_VERSION)
      throw new Error("需要安全注入 NEXT_CONFIG_MASTER_KEY 与 NEXT_CONFIG_KEY_VERSION");
    await createProfileStore().rotate((row) =>
      rotateEnvelope(row, {
        ...process.env,
        CONFIG_MASTER_KEY: process.env.NEXT_CONFIG_MASTER_KEY,
        CONFIG_KEY_VERSION: process.env.NEXT_CONFIG_KEY_VERSION,
      }),
    );
    console.info("密文已原子轮换；请同步更新 app/worker 主密钥后重启。");
  } else if (command === "import") {
    const repository = createContentRepository({ postsDirectory: path.join(contentRoot, "posts") });
    const inputs = repository.getAllPosts().flatMap((metadata) => {
      const post = repository.getPostBySlug(metadata.slug)!;
      const { slug, readingTime, ...front } = post.metadata;
      void readingTime;
      try {
        return [
          {
            ...parseDraft({ slug, metadata: front, body: post.content }),
            published: front.published,
          },
        ];
      } catch {
        console.error(`不兼容内容：${slug}（正文安全规则或元数据校验失败；该批次不会导入）`);
        process.exitCode = 1;
        return [];
      }
    });
    if (process.exitCode) throw new Error("Import validation failed");
    const apply = args.includes("--apply");
    const fingerprint = apply ? await publishFingerprint() : "dry-run";
    if (apply) for (const input of inputs) await prepareMedia(input.mediaIds, input.checksum);
    const report = await createPublishingStore().importBatch(inputs, apply, fingerprint);
    console.table(report);
    if (report.some((row) => row.status === "conflict"))
      throw new Error("导入冲突，整批未写入，请查看报告");
    console.info(`${apply ? "导入完成" : "仅 dry-run，未写入"}：${inputs.length} 篇。`);
  } else if (command === "search") {
    const query = args.slice(1).join(" ");
    if (!query.trim()) throw new Error("需要查询文本");
    if (contentSource() === "file") console.info(await retrieveBlogKnowledge(query));
    else {
      const config = await effectiveEmbedding(),
        database = createDatabase();
      console.info(
        await retrieveRelevantChunks({
          query,
          config: parseRetrievalConfig(process.env),
          embedding: createEmbeddingService(config),
          db: database.db,
          search: (_db, vector, options) =>
            createTaskStore(database).search(vector, options, embeddingFingerprint(config)),
        }),
      );
    }
  } else if (command === "index") {
    if (contentSource() === "database") {
      if (args.includes("--dry-run")) {
        console.info(
          `待核对公开内容：${(await createPublishingStore().published()).length} 篇，未入队。`,
        );
      } else
        console.info(
          `已入队：${await createTaskStore().enqueuePublished(await publishFingerprint())} 篇。`,
        );
    } else {
      const database = createDatabase(),
        embeddingConfig = parseEmbeddingConfig(process.env),
        postsDirectory = path.join(contentRoot, "posts"),
        dryRun = args.includes("--dry-run");
      const stats = await indexPublishedPosts({
        repository: createContentRepository({ postsDirectory }),
        postsDirectory,
        database,
        embeddingConfig,
        embeddingService: dryRun ? undefined : createEmbeddingService(embeddingConfig),
        dryRun,
      });
      console.info(stats);
    }
  } else
    throw new Error(
      "命令：password | secrets [新文件] | import [--apply] | index [--dry-run] | freeze-embedding | rotate-master",
    );
} catch {
  console.error(
    "操作未完成。请核对命令、环境配置、内容校验和冲突报告；未输出秘密或数据库连接信息。",
  );
  process.exitCode = 1;
} finally {
  if (command !== "secrets") await createDatabase().close();
}
