import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function timingSafeMatch(received: string, expected: string) {
  const left = crypto.createHash("sha256").update(received).digest();
  const right = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(left, right);
}

function noStoreJson(body: Record<string, unknown>, status = 200, extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });
}

export async function POST(request: NextRequest) {
  const address = clientAddress(request);
  const now = Date.now();
  const current = attempts.get(address);

  if (current && current.resetAt > now && current.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    return noStoreJson(
      { success: false, error: "Too many attempts. Try again later." },
      429,
      { "Retry-After": String(retryAfter) }
    );
  }
  if (current && current.resetAt <= now) attempts.delete(address);

  const correctPasscode = process.env.APP_PASSCODE;
  if (!correctPasscode || correctPasscode.length < 8) {
    console.error("APP_PASSCODE is missing or too short.");
    return noStoreJson({ success: false, error: "Authentication is not configured." }, 500);
  }

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 1024) {
      return noStoreJson({ success: false, error: "Invalid request." }, 413);
    }

    const payload = (await request.json()) as { passcode?: unknown };
    const passcode = typeof payload.passcode === "string" ? payload.passcode : "";
    if (!passcode || passcode.length > 256 || !timingSafeMatch(passcode, correctPasscode)) {
      const previous = attempts.get(address);
      attempts.set(address, {
        count: (previous?.count || 0) + 1,
        resetAt: previous?.resetAt && previous.resetAt > now ? previous.resetAt : now + WINDOW_MS,
      });
      return noStoreJson({ success: false, error: "Incorrect passcode." }, 401);
    }

    attempts.delete(address);
    const session = await getSession();
    session.isLoggedIn = true;
    await session.save();
    return noStoreJson({ success: true });
  } catch (error) {
    console.error("Login request failed", error);
    return noStoreJson({ success: false, error: "Invalid request." }, 400);
  }
}
