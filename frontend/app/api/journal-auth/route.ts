import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { journalPasscode, journalUnlockDurationMs } from "@/lib/env";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1024;
const MAX_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 15 * 60 * 1000;

function privateJson(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, private, max-age=0",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function safeEqual(left: string, right: string) {
  const leftHash = crypto.createHash("sha256").update(left).digest();
  const rightHash = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return privateJson({ error: "Unauthorized" }, 401);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) return privateJson({ error: "Invalid request." }, 413);

  const now = Date.now();
  if (session.journalUnlockBlockedUntil && session.journalUnlockBlockedUntil > now) {
    return privateJson({ error: "Too many attempts. Try again shortly." }, 429);
  }

  try {
    const payload = await request.json() as { passcode?: unknown };
    const passcode = typeof payload.passcode === "string" ? payload.passcode : "";
    if (!passcode || passcode.length > 256 || !safeEqual(passcode, journalPasscode())) {
      const failures = (session.journalUnlockFailures || 0) + 1;
      session.journalUnlockFailures = failures;
      if (failures >= MAX_ATTEMPTS) {
        session.journalUnlockFailures = 0;
        session.journalUnlockBlockedUntil = now + BLOCK_WINDOW_MS;
      }
      await session.save();
      return privateJson({ error: "Incorrect journal passcode." }, 401);
    }

    session.journalUnlockedUntil = now + journalUnlockDurationMs();
    session.journalUnlockFailures = 0;
    session.journalUnlockBlockedUntil = undefined;
    await session.save();
    return privateJson({ success: true, expiresAt: session.journalUnlockedUntil });
  } catch (error) {
    console.error("Journal unlock failed", error instanceof Error ? error.message : "unknown error");
    return privateJson({ error: "Journal unlock is unavailable." }, 503);
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session.isLoggedIn) return privateJson({ error: "Unauthorized" }, 401);
  session.journalUnlockedUntil = undefined;
  await session.save();
  return privateJson({ success: true });
}
