/**
 * Session-scoped cache utility for DOOR frontend.
 *
 * - First load: fetches from database, stores in sessionStorage.
 * - Subsequent reads: serves from sessionStorage (no network request).
 * - Mutations: write to DB, then update cache locally (no full refetch).
 * - Tab close: sessionStorage is automatically wiped by the browser.
 *
 * All keys are prefixed with "door_sc_" to avoid collisions.
 * A 10-minute TTL is enforced — stale entries are refetched.
 */

const PREFIX = "door_sc_";
const TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CacheEnvelope<T> {
  data: T;
  ts: number; // timestamp when cached
}

/** Read a value from session cache. Returns null if missing or expired. */
export function getCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    if (localStorage.getItem("jujum-demo-mode") === "true") {
      return null;
    }
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (Date.now() - envelope.ts > TTL_MS) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    return envelope.data;
  } catch {
    return null;
  }
}

/** Write a value to session cache with current timestamp. */
export function setCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: CacheEnvelope<T> = { data, ts: Date.now() };
    sessionStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // Ignore quota errors silently
  }
}

/** Remove a specific key from session cache. */
export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(PREFIX + key);
}

/** Remove all DOOR session cache keys. */
export function clearAllCache(): void {
  if (typeof window === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(PREFIX)) keysToRemove.push(k);
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
}

/**
 * Cache-aware fetch wrapper.
 *
 * If `force` is false (default) and a valid cached value exists, returns it immediately.
 * Otherwise calls `fetchFn`, caches the result, and returns it.
 */
export async function cachedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  force = false
): Promise<T> {
  if (!force) {
    const cached = getCache<T>(key);
    if (cached !== null) return cached;
  }
  const data = await fetchFn();
  setCache(key, data);
  return data;
}

/**
 * Update cached data in-place using a transformer function.
 * Reads current cache → applies transform → writes back.
 * Returns the updated data, or null if no cache existed.
 */
export function updateCache<T>(key: string, updater: (current: T) => T): T | null {
  const current = getCache<T>(key);
  if (current === null) return null;
  const updated = updater(current);
  setCache(key, updated);
  return updated;
}
