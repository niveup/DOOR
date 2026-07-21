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

// Global in-memory log store as fallback for server process
const fallbackLogStore: Map<string, StoredStudyLogRecord> = new Map();

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

async function signedFetch(path: string, options: RequestInit = {}) {
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

  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    return null;
  }
  return response.json();
}

export async function saveStudyLogToD1(log: StoredStudyLogRecord): Promise<boolean> {
  // Always store in server fallback store
  fallbackLogStore.set(log.id, log);

  try {
    const result = await signedFetch("/v1/tracker/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(log),
    });
    return Boolean(result?.success);
  } catch (error) {
    console.warn("D1 Tracker Log Save Warning:", error);
    return false;
  }
}

export async function fetchStudyLogsFromD1(): Promise<StoredStudyLogRecord[]> {
  let allLogs: StoredStudyLogRecord[] = [];
  try {
    const result = await signedFetch("/v1/tracker/logs?limit=100", { method: "GET" });
    if (result && Array.isArray(result.logs) && result.logs.length > 0) {
      for (const log of result.logs) {
        fallbackLogStore.set(log.id, log);
      }
      allLogs = result.logs as StoredStudyLogRecord[];
    }
  } catch (error) {
    console.warn("D1 Tracker Log Fetch Warning:", error);
  }

  if (allLogs.length === 0) {
    allLogs = Array.from(fallbackLogStore.values());
  }

  // Deduplication by unique log ID only — composite-key dedup was incorrectly
  // dropping legitimate separate study sessions with the same date/timeBlock/subject/hours
  const seenIds = new Set<string>();
  const deduplicated: StoredStudyLogRecord[] = [];

  for (const log of allLogs) {
    if (seenIds.has(log.id)) continue;
    seenIds.add(log.id);
    deduplicated.push(log);
  }

  return deduplicated.sort(
    (a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime() || b.createdAt - a.createdAt
  );
}


export async function clearTrackerLogsInD1(): Promise<boolean> {
  fallbackLogStore.clear();
  try {
    const result = await signedFetch("/v1/tracker/logs", { method: "DELETE" });
    return Boolean(result?.success);
  } catch (error) {
    console.warn("D1 Tracker Log Clear Warning:", error);
    return false;
  }
}



