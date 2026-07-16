export type RateLimitResult = Readonly<{
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}>;

type WindowEntry = {
  count: number;
  expiresAt: number;
};

type MemoryRateLimiterOptions = Readonly<{
  limit: number;
  windowMs: number;
}>;

export function createMemoryRateLimiter({ limit, windowMs }: MemoryRateLimiterOptions) {
  const windows = new Map<string, WindowEntry>();
  let lastCleanup = 0;

  function cleanup(now: number): void {
    if (now - lastCleanup < windowMs) {
      return;
    }
    for (const [key, entry] of windows) {
      if (entry.expiresAt <= now) {
        windows.delete(key);
      }
    }
    lastCleanup = now;
  }

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      cleanup(now);
      const current = windows.get(key);
      const entry =
        !current || current.expiresAt <= now ? { count: 0, expiresAt: now + windowMs } : current;

      if (entry.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
        };
      }

      entry.count += 1;
      windows.set(key, entry);
      return {
        allowed: true,
        remaining: limit - entry.count,
        retryAfterSeconds: 0,
      };
    },
    size(): number {
      return windows.size;
    },
  };
}

export const chatRateLimiter = createMemoryRateLimiter({ limit: 10, windowMs: 60_000 });

export function getClientRateLimitKey(
  request: Request,
  env: Readonly<Record<string, string | undefined>>,
): string {
  // Only trust x-forwarded-for when a known reverse proxy removes the incoming
  // client header and writes its own value. Set TRUST_PROXY=true only under
  // that deployment contract. Next's Request does not expose a socket address.
  if (env.TRUST_PROXY === "true") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) {
      return `ip:${forwarded}`;
    }
  }

  // Without a trusted proxy all clients share this stable bucket. This is a
  // conservative single-instance fallback, not distributed rate limiting.
  return "anonymous";
}
