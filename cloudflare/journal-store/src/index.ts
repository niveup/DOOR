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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/v1/entries") return listEntries(request, env);
    if (request.method === "POST" && url.pathname === "/v1/entries") return saveEntry(request, env);
    return json({ error: "Not found" }, 404);
  },
};
