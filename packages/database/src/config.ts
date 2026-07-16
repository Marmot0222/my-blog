import { z } from "zod";

const databaseUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("postgresql://") || value.startsWith("postgres://"));

const environmentSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
});

export type DatabaseConfig = Readonly<{
  connectionString: string;
  poolMax: number;
}>;

export class DatabaseConfigurationError extends Error {
  readonly code = "KNOWLEDGE_BASE_NOT_CONFIGURED" as const;

  constructor() {
    super("知识库数据库尚未配置");
    this.name = "DatabaseConfigurationError";
  }
}

export function parseDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    throw new DatabaseConfigurationError();
  }
  return {
    connectionString: result.data.DATABASE_URL,
    poolMax: result.data.DATABASE_POOL_MAX,
  };
}
