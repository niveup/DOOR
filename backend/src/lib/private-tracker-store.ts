import crypto from "node:crypto";

export type StoredStudyLogRecord = {
  id: string;
  logDate: string;
  timeBlock: string;
  subjectId: number;
  subjectName: string;
  hoursStudied: number;
  questionsSolved: number;
  notes: string | null;
  createdAt: number;
};

// Postgres (Prisma StudyLog) is the primary durable store. This module mirrors
// records into Cloudflare D1 as a secondary copy. The former in-memory
// fallbackLogStore Map was removed: it grew without bound and silently
// diverged from D1 after restarts (audit finding F-CODE-4 / GA-123).

const FETCH_TIMEOUT_MS = 15_000;

function storeConfig() {
  const rawUrl = process.env.CF_JOURNAL_STORE_URL;
  const secret = process.env.CF_JOURNAL_STORE_SECRET;
  if (!rawUrl || !secret || rawUrl.length < 12 || secret.length < 32) {
    return null;
  }
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return null;
    return { url: url.toString().replace(/\/$/, ""), secret };
  } catch {
    return null;
  }
}

export async function signedFetch(path: string, options: RequestInit = {}): Promise<Response | null> {
  const config = storeConfig();
  if (!config) return null;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyText = typeof options.body === "string" ? options.body : "";
  const hmac = crypto.createHmac("sha256", config.secret);
  hmac.update(`${timestamp}.${bodyText}`);
  const signature = hmac.digest("base64url");

  const headers = new Headers(options.headers);
  headers.set("X-Journal-Timestamp", timestamp);
  headers.set("X-Journal-Signature", signature);

  try {
    return await fetch(`${config.url}${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn("D1 store request failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

export async function saveStudyLogToD1(log: StoredStudyLogRecord): Promise<boolean> {
  try {
    const result = await signedFetch("/v1/tracker/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    });
    if (!result || !result.ok) return false;
    const payload = (await result.json().catch(() => ({}))) as { success?: boolean };
    return Boolean(payload?.success);
  } catch (error) {
    console.warn("D1 Tracker Log Save Warning:", error);
    return false;
  }
}

export async function fetchStudyLogsFromD1(): Promise<StoredStudyLogRecord[]> {
  try {
    const result = await signedFetch("/v1/tracker/logs?limit=200", { method: "GET" });
    if (!result || !result.ok) return [];
    const payload = (await result.json().catch(() => ({}))) as { logs?: unknown };
    if (!Array.isArray(payload.logs)) return [];
    return payload.logs as StoredStudyLogRecord[];
  } catch (error) {
    console.warn("D1 Tracker Log Fetch Warning:", error);
    return [];
  }
}

export async function clearTrackerLogsInD1(): Promise<boolean> {
  try {
    const result = await signedFetch("/v1/tracker/logs", { method: "DELETE" });
    if (!result || !result.ok) return false;
    const payload = (await result.json().catch(() => ({}))) as { success?: boolean };
    return Boolean(payload?.success);
  } catch (error) {
    console.warn("D1 Tracker Log Clear Warning:", error);
    return false;
  }
}
