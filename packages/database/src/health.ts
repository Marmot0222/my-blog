import { createDatabase } from "./client";
export async function checkPublishingHealth() {
  await createDatabase().pool.query("SELECT id FROM articles LIMIT 0");
}
