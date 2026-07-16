interface HealthPayload {
  status: "ok";
  version: string;
  timestamp: string;
}

export function createHealthPayload(
  env: Readonly<Record<string, string | undefined>> = process.env,
  now: Date = new Date(),
): HealthPayload {
  return {
    status: "ok",
    version: env.APP_VERSION?.trim() || "unknown",
    timestamp: now.toISOString(),
  };
}
