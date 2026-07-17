import crypto from "node:crypto";
import { appPasscode, backendApiUrl } from "@/lib/env";

const CIPHER_PREFIX = "door-journal:v1:";
const MAX_HISTORY_LIMIT = 90;

export interface JournalPayload {
  entryText: string;
  mood: string | null;
  tags: string[];
  studyDone: boolean;
  exerciseDone: boolean;
  readingDone: boolean;
  aiFeedback: string | null;
  tomorrowTask: string | null;
  patternDetected: string | null;
}

export interface JournalEntry extends JournalPayload {
  journalId: string;
  date: string;
  createdAt: string;
  editedAt: string;
}

type StoredJournalRecord = {
  id: string;
  date: string;
  ciphertext: string;
  createdAt: number;
  editedAt: number;
};

type WorkerPayload = { entry: StoredJournalRecord };
type WorkerListPayload = { entries: StoredJournalRecord[] };

type JournalFeedbackRequest = Pick<JournalPayload, "entryText" | "mood" | "tags" | "studyDone" | "exerciseDone" | "readingDone"> & {
  history: Array<Pick<JournalEntry, "date" | "entryText" | "mood">>;
  aiProvider?: string;
  aiModel?: string;
};

type JournalFeedbackResponse = {
  aiFeedback: string;
  tomorrowTask: string | null;
  patternDetected: string | null;
};

function requiredSecret(name: string, value: string | undefined, minLength = 32) {
  if (!value || value.length < minLength) throw new Error(`${name} is not configured.`);
  return value;
}

function journalEncryptionKey() {
  return crypto.createHash("sha256").update(requiredSecret("JOURNAL_ENCRYPTION_KEY", process.env.JOURNAL_ENCRYPTION_KEY)).digest();
}

function storeConfig() {
  const rawUrl = requiredSecret("CF_JOURNAL_STORE_URL", process.env.CF_JOURNAL_STORE_URL, 12);
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("CF_JOURNAL_STORE_URL must use HTTPS.");
  return { url: url.toString().replace(/\/$/, ""), secret: requiredSecret("CF_JOURNAL_STORE_SECRET", process.env.CF_JOURNAL_STORE_SECRET) };
}

export function encryptJournalPayload(payload: JournalPayload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", journalEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${CIPHER_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString("base64url")}`;
}

export function decryptJournalPayload(ciphertext: string): JournalPayload {
  if (!ciphertext.startsWith(CIPHER_PREFIX)) throw new Error("Journal record is not encrypted with the active format.");
  const packed = Buffer.from(ciphertext.slice(CIPHER_PREFIX.length), "base64url");
  if (packed.length < 29) throw new Error("Journal record is malformed.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", journalEncryptionKey(), packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  const raw = Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8");
  const value = JSON.parse(raw) as Partial<JournalPayload>;
  if (typeof value.entryText !== "string" || !Array.isArray(value.tags)) throw new Error("Journal record has an invalid payload.");
  return {
    entryText: value.entryText,
    mood: typeof value.mood === "string" ? value.mood : null,
    tags: value.tags.filter((tag): tag is string => typeof tag === "string"),
    studyDone: Boolean(value.studyDone),
    exerciseDone: Boolean(value.exerciseDone),
    readingDone: Boolean(value.readingDone),
    aiFeedback: typeof value.aiFeedback === "string" ? value.aiFeedback : null,
    tomorrowTask: typeof value.tomorrowTask === "string" ? value.tomorrowTask : null,
    patternDetected: typeof value.patternDetected === "string" ? value.patternDetected : null,
  };
}

async function storeRequest<T>(method: "GET" | "POST", pathname: string, body?: unknown): Promise<T> {
  const { url, secret } = storeConfig();
  const bodyText = body === undefined ? "" : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${bodyText}`).digest("base64url");
  const response = await fetch(`${url}${pathname}`, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Journal-Timestamp": timestamp,
      "X-Journal-Signature": signature,
    },
    body: method === "POST" ? bodyText : undefined,
  });
  const parsed = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(parsed.error || "Private journal storage is unavailable.");
  return parsed;
}

function toJournalEntry(record: StoredJournalRecord): JournalEntry {
  return {
    journalId: record.id,
    date: record.date,
    createdAt: new Date(record.createdAt).toISOString(),
    editedAt: new Date(record.editedAt).toISOString(),
    ...decryptJournalPayload(record.ciphertext),
  };
}

export async function listJournalEntries(limit = 30) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 30, 1), MAX_HISTORY_LIMIT);
  const result = await storeRequest<WorkerListPayload>("GET", `/v1/entries?limit=${safeLimit}`);
  return result.entries.map(toJournalEntry);
}

export async function saveJournalEntry(date: string, payload: JournalPayload) {
  const now = Date.now();
  const result = await storeRequest<WorkerPayload>("POST", "/v1/entries", {
    id: crypto.randomUUID(),
    date,
    ciphertext: encryptJournalPayload(payload),
    createdAt: now,
    editedAt: now,
  });
  return toJournalEntry(result.entry);
}

export async function getJournalFeedback(input: JournalFeedbackRequest): Promise<JournalFeedbackResponse> {
  const response = await fetch(`${backendApiUrl()}/api/journal/feedback`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Passcode": appPasscode() },
    body: JSON.stringify(input),
  });
  const payload = await response.json().catch(() => ({})) as Partial<JournalFeedbackResponse> & { error?: string };
  if (!response.ok || typeof payload.aiFeedback !== "string") throw new Error(payload.error || "Mentor feedback is unavailable.");
  return {
    aiFeedback: payload.aiFeedback,
    tomorrowTask: typeof payload.tomorrowTask === "string" ? payload.tomorrowTask : null,
    patternDetected: typeof payload.patternDetected === "string" ? payload.patternDetected : null,
  };
}

export function kolkataJournalDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
