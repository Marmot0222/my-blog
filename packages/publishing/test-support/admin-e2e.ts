import { createPublishingStore, createDatabase } from "@ting-lab/database";
import { hashPassword } from "../src/secrets";
import { freezeEmbedding } from "../src/config";

async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_test"))
    throw new Error("Isolated local test database required");
  if (!process.env.ADMIN_PASSWORD) throw new Error("Test administrator password required");
  process.env.DATABASE_URL = url.toString();
  process.env.EMBEDDING_PROVIDER = "openai";
  process.env.EMBEDDING_MODEL = "fixture-embedding";
  process.env.EMBEDDING_API_KEY = "fake-never-sent";
  process.env.EMBEDDING_DIMENSIONS = "2048";
  const runtime = createDatabase();
  try {
    await createPublishingStore(runtime).setPassword(
      await hashPassword(process.env.ADMIN_PASSWORD),
    );
    await runtime.pool.query("DELETE FROM admin_rate_limits WHERE bucket='login'");
    await freezeEmbedding(true);
  } finally {
    await runtime.close();
  }
}

await setup();
