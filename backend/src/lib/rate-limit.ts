import type { Request } from "express";

/**
 * Zero-dependency in-memory rate limiter (audit GA-102).
 * Correct for the single-replica Render deployment; if the app ever scales
 * beyond one replica, swap the store for a shared one (Redis/Upstash).
 *
 * Keys are derived from X-Forwarded-For (Render/Vercel set it) falling back
 * to req.ip. A spoofed XFF only lets an attacker split their own quota, not
 * exceed the global per-route budget.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /** Count this attempt against the key's budget. */
  hit(key: string): RateLimitResult;
  /** Inspect without counting. */
  peek(key: string): RateLimitResult;
  /** Clear a key's history (e.g. after a successful credential). */
  reset(key: string): void;
}

const MAX_TRACKED_KEYS = 10_000;

export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter {
  const { windowMs, max } = options;
  const hits = new Map<string, { count: number; expiresAt: number }>();

  function prune(now: number): void {
    if (hits.size < 512) return;
    for (const [key, entry] of hits) {
      if (entry.expiresAt <= now) hits.delete(key);
    }
    if (hits.size > MAX_TRACKED_KEYS) {
      // absolute memory bound: drop the soonest-expiring half
      const ordered = [...hits.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      for (let i = 0; i < ordered.length / 2; i++) hits.delete(ordered[i][0]);
    }
  }

  function snapshot(key: string, now: number): RateLimitResult {
    const entry = hits.get(key);
    if (!entry || entry.expiresAt <= now) {
      return { allowed: true, remaining: max, retryAfterSeconds: 0 };
    }
    const allowed = entry.count < max;
    return {
      allowed,
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
      const allowed = entry.count <= max;
      const remaining = Math.max(0, max - entry.count);
      const retryAfterSeconds = allowed ? 0 : Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
      return { allowed, remaining, retryAfterSeconds };
    },
    peek(key) {
      return snapshot(key, Date.now());
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

/** Best-effort client identity behind the Render/Vercel proxy. */
export function clientKey(req: Pick<Request, "ip" | "headers">): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}
