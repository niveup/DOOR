import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter, clientKey } from "../src/lib/rate-limit.ts";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("allows up to max hits, then blocks with a retry hint", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
  assert.equal(limiter.hit("a").allowed, true);
  assert.equal(limiter.hit("a").allowed, true);
  const third = limiter.hit("a");
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);
  const fourth = limiter.hit("a");
  assert.equal(fourth.allowed, false);
  assert.ok(fourth.retryAfterSeconds >= 1);
});

test("keys are isolated - one client never blocks another", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  limiter.hit("ip-1"); limiter.hit("ip-1"); limiter.hit("ip-1");
  assert.equal(limiter.peek("ip-1").allowed, false);
  assert.equal(limiter.peek("ip-2").allowed, true);
});

test("window expiry restores the budget", async () => {
  const limiter = createRateLimiter({ windowMs: 25, max: 1 });
  assert.equal(limiter.hit("burst").allowed, true);
  assert.equal(limiter.hit("burst").allowed, false);
  await sleep(200); // 8x the window - deterministic even on slow CI
  assert.equal(limiter.hit("burst").allowed, true);
});

test("reset clears the brake after a successful credential", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
  limiter.hit("user");
  assert.equal(limiter.peek("user").allowed, false);
  limiter.reset("user");
  assert.equal(limiter.peek("user").allowed, true);
});

test("peek does not consume the budget", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  limiter.peek("p"); limiter.peek("p"); limiter.peek("p");
  assert.equal(limiter.hit("p").remaining, 1);
});

test("clientKey prefers the proxy header over req.ip", () => {
  const key = clientKey({
    ip: "10.0.0.1",
    headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
  });
  assert.equal(key, "203.0.113.7");
});
