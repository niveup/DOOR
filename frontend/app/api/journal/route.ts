import { NextRequest, NextResponse } from "next/server";
import { hasActiveJournalSession, getSession } from "@/lib/session";
import { appPasscode, backendApiUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pure session-gated proxy to the Express journal endpoints (audit: journal
// single-writer). Encryption, validation of content shape, AI feedback, and D1
// persistence all live in backend/src/routes/journal.ts; this route only
// enforces the web session + journal-unlock gate, validates the web contract,
// and translates shapes. It holds no keys and performs no crypto.

const MAX_BODY_BYTES = 24 * 1024;
const UPSTREAM_TIMEOUT_MS = 110_000;
const MOODS = new Set(["1", "2", "3", "4", "5"]);
const TAGS = new Set(["Study", "Exercise", "Reading", "Sleep", "Phone", "Other"]);

function privateJson(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      Vary: "Cookie",
    },
  });
}

async function requireJournalAccess() {
  const session = await getSession();
  return session.isLoggedIn && hasActiveJournalSession(session);
}

function validTags(value: unknown) {
  if (!Array.isArray(value) || value.length > TAGS.size) return null;
  const tags = value.filter((tag): tag is string => typeof tag === "string" && TAGS.has(tag));
  return tags.length === value.length ? [...new Set(tags)] : null;
}

function kolkataDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toWebEntry(entry: Record<string, unknown>): Record<string, unknown> {
  const rawDate = typeof entry.date === "string" ? entry.date : "";
  return {
    journalId: entry.journalId ?? null,
    date: rawDate.slice(0, 10),
    entryText: typeof entry.entryText === "string" ? entry.entryText : "",
    mood: typeof entry.mood === "string" ? entry.mood : null,
    tags: Array.isArray(entry.tags) ? entry.tags.filter((t): t is string => typeof t === "string") : [],
    aiFeedback: typeof entry.aiFeedback === "string" ? entry.aiFeedback : null,
    tomorrowTask: typeof entry.tomorrowTask === "string" ? entry.tomorrowTask : null,
    patternDetected: typeof entry.patternDetected === "string" ? entry.patternDetected : null,
    studyDone: entry.studyDone === true,
    exerciseDone: entry.exerciseDone === true,
    readingDone: entry.readingDone === true,
  };
}

async function callBackend(path: string, init?: RequestInit): Promise<{ status: number; payload: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`${backendApiUrl()}${path}`, {
      ...init,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-passcode": appPasscode(),
        ...(init?.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      status: timedOut ? 504 : 502,
      payload: { error: timedOut ? "Backend request timed out." : "Backend is unavailable." },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  if (!await requireJournalAccess()) return privateJson({ error: "Journal is locked." }, 401);
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 30);
  const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 30, 1), 90);
  const { status, payload } = await callBackend(`/api/journal/history?limit=${limit}`);
  if (status !== 200 || !Array.isArray(payload.entries)) {
    return privateJson({ error: payload.error || "Private journal storage is unavailable." }, status === 200 ? 503 : status);
  }
  return privateJson({ entries: payload.entries.map(toWebEntry) });
}

export async function POST(request: NextRequest) {
  if (!await requireJournalAccess()) return privateJson({ error: "Journal is locked." }, 401);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
    return privateJson({ error: "Journal entry is too large." }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return privateJson({ error: "Invalid journal request." }, 400);
  }

  const entryText = typeof body.entryText === "string" ? body.entryText.trim() : "";
  const mood = typeof body.mood === "string" ? body.mood : "";
  const tags = validTags(body.tags);
  if (entryText.length < 20 || entryText.length > 5000 || !tags || !MOODS.has(mood)) {
    return privateJson({ error: "Journal entry must be between 20 and 5000 characters with valid metadata." }, 400);
  }

  const { status, payload } = await callBackend("/api/journal/entry", {
    method: "POST",
    body: JSON.stringify({
      content: entryText,
      mood,
      tags,
      date: kolkataDate(),
      studyDone: body.studyDone === true,
      exerciseDone: body.exerciseDone === true,
      readingDone: body.readingDone === true,
    }),
  });

  if (status !== 200 || !payload.entry) {
    const message = payload.error || "Journal entry could not be saved.";
    return privateJson({ success: false, journal: null, error: message, friendlyMessage: message }, status);
  }
  return privateJson({ success: true, journal: toWebEntry(payload.entry) });
}
