export interface Env {
  JOURNAL_DB: D1Database;
  JOURNAL_SERVICE_SECRET: string;
}

type StoredEntry = {
  id: string;
  date: string;
  ciphertext: string;
  createdAt: number;
  editedAt: number;
};

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, private, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers });
}

function base64url(bytes: ArrayBuffer) {
  let text = "";
  for (const byte of new Uint8Array(bytes)) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

async function authenticate(request: Request, env: Env, body: string) {
  const timestamp = request.headers.get("X-Journal-Timestamp") || "";
  const supplied = request.headers.get("X-Journal-Signature") || "";
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(Date.now() - seconds * 1000) > 5 * 60 * 1000 || !supplied) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.JOURNAL_SERVICE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  return safeEqual(supplied, base64url(signature));
}

function toEntry(row: Record<string, unknown>): StoredEntry {
  return {
    id: String(row.id),
    date: String(row.entry_date),
    ciphertext: String(row.ciphertext),
    createdAt: Number(row.created_at),
    editedAt: Number(row.edited_at),
  };
}

async function listEntries(request: Request, env: Env) {
  if (!await authenticate(request, env, "")) return json({ error: "Unauthorized" }, 401);
  const requested = Number(new URL(request.url).searchParams.get("limit") || 30);
  const limit = Math.min(Math.max(Number.isInteger(requested) ? requested : 30, 1), 90);
  const result = await env.JOURNAL_DB.prepare("SELECT id, entry_date, ciphertext, created_at, edited_at FROM journal_entries ORDER BY entry_date DESC LIMIT ?").bind(limit).all();
  return json({ entries: (result.results || []).map(toEntry) });
}

async function saveEntry(request: Request, env: Env) {
  const body = await request.text();
  if (body.length > 32 * 1024) return json({ error: "Request too large" }, 413);
  if (!await authenticate(request, env, body)) return json({ error: "Unauthorized" }, 401);
  let input: Partial<StoredEntry>;
  try {
    input = JSON.parse(body) as Partial<StoredEntry>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!/^[a-zA-Z0-9_-]{10,128}$/.test(input.id || "") || !/^\d{4}-\d{2}-\d{2}$/.test(input.date || "") || typeof input.ciphertext !== "string" || input.ciphertext.length < 32 || input.ciphertext.length > 24000 || !Number.isFinite(input.createdAt) || !Number.isFinite(input.editedAt)) {
    return json({ error: "Invalid journal record" }, 400);
  }
  await env.JOURNAL_DB.prepare(
    "INSERT INTO journal_entries (id, entry_date, ciphertext, created_at, edited_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(entry_date) DO UPDATE SET ciphertext = excluded.ciphertext, edited_at = excluded.edited_at"
  ).bind(input.id, input.date, input.ciphertext, input.createdAt, input.editedAt).run();
  const saved = await env.JOURNAL_DB.prepare("SELECT id, entry_date, ciphertext, created_at, edited_at FROM journal_entries WHERE entry_date = ?").bind(input.date).first<Record<string, unknown>>();
  return json({ entry: saved ? toEntry(saved) : null });
}

type StudyLogRecord = {
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

function toStudyLog(row: Record<string, unknown>): StudyLogRecord {
  return {
    id: String(row.id),
    logDate: String(row.log_date),
    timeBlock: String(row.time_block || "Evening"),
    subjectId: Number(row.subject_id),
    subjectName: String(row.subject_name),
    hoursStudied: Number(row.hours_studied),
    questionsSolved: Number(row.questions_solved),
    notes: row.notes ? String(row.notes) : null,
    createdAt: Number(row.created_at),
  };
}

async function listTrackerLogs(request: Request, env: Env) {
  if (!await authenticate(request, env, "")) return json({ error: "Unauthorized" }, 401);
  const requested = Number(new URL(request.url).searchParams.get("limit") || 50);
  const limit = Math.min(Math.max(Number.isInteger(requested) ? requested : 50, 1), 200);
  const result = await env.JOURNAL_DB.prepare("SELECT id, log_date, time_block, subject_id, subject_name, hours_studied, questions_solved, notes, created_at FROM tracker_study_logs ORDER BY log_date DESC, created_at DESC LIMIT ?").bind(limit).all();
  return json({ logs: (result.results || []).map(toStudyLog) });
}

async function saveTrackerLog(request: Request, env: Env) {
  const body = await request.text();
  if (body.length > 32 * 1024) return json({ error: "Request too large" }, 413);
  if (!await authenticate(request, env, body)) return json({ error: "Unauthorized" }, 401);
  let input: Partial<StudyLogRecord>;
  try {
    input = JSON.parse(body) as Partial<StudyLogRecord>;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!input.id || !input.logDate || typeof input.subjectId !== "number" || typeof input.subjectName !== "string") {
    return json({ error: "Invalid tracker log record" }, 400);
  }
  const id = input.id;
  const logDate = input.logDate;
  const timeBlock = input.timeBlock || "Evening";
  const subjectId = input.subjectId;
  const subjectName = input.subjectName;
  const hoursStudied = Number(input.hoursStudied || 0);
  const questionsSolved = Number(input.questionsSolved || 0);
  const notes = input.notes || null;
  const createdAt = input.createdAt || Date.now();

  await env.JOURNAL_DB.prepare(
    "INSERT INTO tracker_study_logs (id, log_date, time_block, subject_id, subject_name, hours_studied, questions_solved, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET hours_studied = excluded.hours_studied, questions_solved = excluded.questions_solved, notes = excluded.notes"
  ).bind(id, logDate, timeBlock, subjectId, subjectName, hoursStudied, questionsSolved, notes, createdAt).run();

  return json({ success: true, id });
}

async function clearTrackerLogs(request: Request, env: Env) {
  if (!await authenticate(request, env, "")) return json({ error: "Unauthorized" }, 401);
  await env.JOURNAL_DB.prepare("DELETE FROM tracker_study_logs").run();
  return json({ success: true, message: "Tracker study logs cleared." });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/v1/entries") return listEntries(request, env);
    if (request.method === "POST" && url.pathname === "/v1/entries") return saveEntry(request, env);
    if (request.method === "GET" && url.pathname === "/v1/tracker/logs") return listTrackerLogs(request, env);
    if (request.method === "POST" && url.pathname === "/v1/tracker/logs") return saveTrackerLog(request, env);
    if (request.method === "DELETE" && url.pathname === "/v1/tracker/logs") return clearTrackerLogs(request, env);
    return json({ error: "Not found" }, 404);
  },
};


