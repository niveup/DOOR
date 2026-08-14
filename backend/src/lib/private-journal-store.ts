import crypto from "node:crypto";

const CIPHER_PREFIX = "door-journal:v1:";

type StoredJournalRecord = {
  id: string;
  date: string;
  ciphertext: string;
  createdAt: number;
  editedAt: number;
};

type WorkerListPayload = { entries: StoredJournalRecord[] };

export type PrivateJournalEntry = {
  journalId: string;
  date: Date;
  entryText: string;
  mood: string | null;
  tags: string[];
  aiFeedback: string | null;
  tomorrowTask: string | null;
  patternDetected: string | null;
  studyDone: boolean;
  exerciseDone: boolean;
  readingDone: boolean;
};

export type PrivateJournalPayload = Omit<PrivateJournalEntry, "journalId" | "date">;

type WorkerSavePayload = { entry: StoredJournalRecord };

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

function decrypt(record: StoredJournalRecord): PrivateJournalEntry {
  if (!record.ciphertext.startsWith(CIPHER_PREFIX)) throw new Error("Journal record is not encrypted with the active format.");
  const packed = Buffer.from(record.ciphertext.slice(CIPHER_PREFIX.length), "base64url");
  if (packed.length < 29) throw new Error("Journal record is malformed.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", journalEncryptionKey(), packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  const value = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8")) as Record<string, unknown>;
  if (typeof value.entryText !== "string" || !Array.isArray(value.tags)) throw new Error("Journal record has an invalid payload.");
  return {
    journalId: record.id,
    date: new Date(`${record.date}T00:00:00.000Z`),
    entryText: value.entryText,
    mood: typeof value.mood === "string" ? value.mood : null,
    tags: value.tags.filter((tag): tag is string => typeof tag === "string"),
    aiFeedback: typeof value.aiFeedback === "string" ? value.aiFeedback : null,
    tomorrowTask: typeof value.tomorrowTask === "string" ? value.tomorrowTask : null,
    patternDetected: typeof value.patternDetected === "string" ? value.patternDetected : null,
    studyDone: value.studyDone === true,
    exerciseDone: value.exerciseDone === true,
    readingDone: value.readingDone === true,
  };
}

function encrypt(payload: PrivateJournalPayload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", journalEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${CIPHER_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString("base64url")}`;
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

export async function listPrivateJournalEntries(limit: number) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 1, 1), 90);
  const { url, secret } = storeConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.`).digest("base64url");
  const response = await fetch(`${url}/v1/entries?limit=${safeLimit}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Journal-Timestamp": timestamp,
      "X-Journal-Signature": signature,
    },
  });
  const payload = await response.json().catch(() => ({})) as Partial<WorkerListPayload> & { error?: string };
  if (!response.ok || !Array.isArray(payload.entries)) throw new Error(payload.error || "Private journal storage is unavailable.");
  return payload.entries.map(decrypt);
}

export async function privateJournalByDate(date: Date) {
  const target = date.toISOString().slice(0, 10);
  const entries = await listPrivateJournalEntries(90);
  return entries.find((entry) => entry.date.toISOString().slice(0, 10) === target) || null;
}

/**
 * Persists an encrypted journal record through the private D1 service. The
 * device never receives the journal-service secret or encryption key.
 */
export async function savePrivateJournalEntry(date: string, payload: PrivateJournalPayload) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Journal date must be YYYY-MM-DD.");
  const now = Date.now();
  const result = await storeRequest<WorkerSavePayload>("POST", "/v1/entries", {
    id: crypto.randomUUID(),
    date,
    ciphertext: encrypt(payload),
    createdAt: now,
    editedAt: now,
  });
  return decrypt(result.entry);
}
