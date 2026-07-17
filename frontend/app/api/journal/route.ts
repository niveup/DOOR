import { NextRequest, NextResponse } from "next/server";
import { hasActiveJournalSession, getSession } from "@/lib/session";
import {
  JournalPayload,
  getJournalFeedback,
  kolkataJournalDate,
  listJournalEntries,
  saveJournalEntry,
} from "@/lib/journal-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 24 * 1024;
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

function parsePayload(value: unknown): Omit<JournalPayload, "aiFeedback" | "tomorrowTask" | "patternDetected"> | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const entryText = typeof body.entryText === "string" ? body.entryText.trim() : "";
  const tags = validTags(body.tags);
  if (entryText.length < 20 || entryText.length > 5000 || !tags || (typeof body.mood !== "string" || !MOODS.has(body.mood))) return null;
  return {
    entryText,
    mood: body.mood,
    tags,
    studyDone: body.studyDone === true,
    exerciseDone: body.exerciseDone === true,
    readingDone: body.readingDone === true,
  };
}

export async function GET(request: NextRequest) {
  if (!await requireJournalAccess()) return privateJson({ error: "Journal is locked." }, 401);
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 30);
  try {
    const entries = await listJournalEntries(requestedLimit);
    return privateJson({ entries });
  } catch (error) {
    console.error("Journal history read failed", error instanceof Error ? error.message : "unknown error");
    return privateJson({ error: "Private journal storage is unavailable." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!await requireJournalAccess()) return privateJson({ error: "Journal is locked." }, 401);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) return privateJson({ error: "Journal entry is too large." }, 413);

  let submitted: Omit<JournalPayload, "aiFeedback" | "tomorrowTask" | "patternDetected"> | null = null;
  let aiProvider: string | undefined;
  let aiModel: string | undefined;
  try {
    const body = await request.json() as Record<string, unknown>;
    submitted = parsePayload(body);
    aiProvider = typeof body.aiProvider === "string" ? body.aiProvider : undefined;
    aiModel = typeof body.aiModel === "string" ? body.aiModel : undefined;
  } catch {
    return privateJson({ error: "Invalid journal request." }, 400);
  }
  if (!submitted) return privateJson({ error: "Journal entry must be between 20 and 5000 characters with valid metadata." }, 400);

  const date = kolkataJournalDate();
  const payload: JournalPayload = { ...submitted, aiFeedback: null, tomorrowTask: null, patternDetected: null };
  try {
    // Persist the encrypted writing first: an AI outage must never lose a draft.
    await saveJournalEntry(date, payload);
  } catch (error) {
    console.error("Encrypted journal save failed", error instanceof Error ? error.message : "unknown error");
    return privateJson({ error: "Private journal storage is unavailable. Your draft has not been sent." }, 503);
  }

  try {
    const priorEntries = (await listJournalEntries(8))
      .filter((entry) => entry.date < date)
      .slice(0, 7)
      .map(({ date: entryDate, entryText, mood }) => ({ date: entryDate, entryText, mood }));
    const feedback = await getJournalFeedback({ ...submitted, history: priorEntries, aiProvider, aiModel });
    const journal = await saveJournalEntry(date, { ...payload, ...feedback });
    return privateJson({ success: true, journal });
  } catch (error) {
    console.error("Journal feedback failed", error instanceof Error ? error.message : "unknown error");
    const journal = await saveJournalEntry(date, payload).catch(() => null);
    return privateJson({
      success: false,
      journal,
      error: "Your encrypted entry was saved, but mentor feedback is temporarily unavailable.",
      friendlyMessage: "Your writing is safely stored. You can return for feedback later.",
    });
  }
}
