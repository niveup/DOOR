export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface RateLimiter {
  hit(key: string): RateLimitResult;
  peek(key: string): RateLimitResult;
  reset(key: string): void;
}

const MAX_TRACKED_KEYS = 10_000;

function create(options: { windowMs: number; max: number }): RateLimiter {
  const { windowMs, max } = options;
  const hits = new Map<string, { count: number; expiresAt: number }>();

  function prune(now: number): void {
    if (hits.size < 512) return;
    for (const [key, entry] of hits) if (entry.expiresAt <= now) hits.delete(key);
    if (hits.size > MAX_TRACKED_KEYS) {
      const ordered = [...hits.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      for (let i = 0; i < ordered.length / 2; i++) hits.delete(ordered[i][0]);
    }
  }
  function snapshot(key: string, now: number): RateLimitResult {
    const entry = hits.get(key);
    if (!entry || entry.expiresAt <= now) return { allowed: true, remaining: max, retryAfterSeconds: 0 };
    return {
      allowed: entry.count < max,
      remaining: Math.max(0, max - entry.count),
      retryAfterSeconds: Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)),
    };
  }

  return {
    hit(key) {
      const now = Date.now();
      prune(now);
      const entry = hits.get(key);
      if (!entry || entry.expiresAt <= now) {
        hits.set(key, { count: 1, expiresAt: now + windowMs });
        return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
      }
      entry.count += 1;
      const result = snapshot(key, now);
      if (!result.allowed) result.retryAfterSeconds = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
      return result;
    },
    peek(key) { return snapshot(key, Date.now()); },
    reset(key) { hits.delete(key); },
  };
}

// Login attempts: 5 failures per 15 minutes triggers a brake (mirrors the
// journal unlock pattern). Successful login clears the counter.
export const loginFailureLimiter = create({ windowMs: 15 * 60_000, max: 5 });
// General hammering cap on the login route itself.
export const loginAttemptLimiter = create({ windowMs: 60_000, max: 20 });

export function clientIp(request: { headers: Headers; }): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
