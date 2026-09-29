import { createDatabase } from "./client";
import { PublishingConflict } from "./publishing";
import type { DatabaseRuntime } from "./types";
export type StoredProfile = {
  name: string;
  version: number;
  profile: Record<string, unknown>;
  key_envelope: Record<string, unknown> | null;
  updated_at: Date;
};
export function createProfileStore(runtime: DatabaseRuntime = createDatabase()) {
  const { pool } = runtime;
  return {
    async read(name: string) {
      return (await pool.query<StoredProfile>("SELECT * FROM model_profiles WHERE name=$1", [name]))
        .rows[0];
    },
    async save(
      name: string,
      version: number,
      profile: Record<string, unknown>,
      envelope: Record<string, unknown> | null,
    ) {
      const result =
        version === 0
          ? await pool.query<StoredProfile>(
              "INSERT INTO model_profiles(name,profile,key_envelope) VALUES($1,$2,$3) ON CONFLICT(name) DO NOTHING RETURNING *",
              [name, profile, envelope],
            )
          : await pool.query<StoredProfile>(
              "UPDATE model_profiles SET profile=$3,key_envelope=$4,version=version+1,updated_at=now() WHERE name=$1 AND version=$2 RETURNING *",
              [name, version, profile, envelope],
            );
      if (!result.rows[0]) throw new PublishingConflict("conflict");
      return result.rows[0];
    },
    async activate(version: number) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const row = (
          await client.query<StoredProfile>(
            "SELECT * FROM model_profiles WHERE name='chat.draft' FOR UPDATE",
          )
        ).rows[0];
        if (!row || row.version !== version) throw new PublishingConflict("conflict");
        await client.query(
          "INSERT INTO model_profiles(name,profile,key_envelope) VALUES('chat.active',$1,$2) ON CONFLICT(name) DO UPDATE SET profile=$1,key_envelope=$2,version=model_profiles.version+1,updated_at=now()",
          [row.profile, row.key_envelope],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async removeChatOverride() {
      await pool.query("DELETE FROM model_profiles WHERE name IN ('chat.active','chat.draft')");
    },
    async rotate(transform: (row: StoredProfile) => Record<string, unknown> | null) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const rows = await client.query<StoredProfile>("SELECT * FROM model_profiles FOR UPDATE");
        for (const row of rows.rows)
          await client.query(
            "UPDATE model_profiles SET key_envelope=$2,version=version+1,updated_at=now() WHERE name=$1",
            [row.name, transform(row)],
          );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
