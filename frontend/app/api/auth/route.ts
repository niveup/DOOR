import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { appPasscode } from "@/lib/env";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeEqual(left: string, right: string) {
  const a = crypto.createHash("sha256").update(left).digest();
  const b = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 1024) {
      return NextResponse.json({ success: false, error: "Invalid request." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    }
    const payload = (await request.json()) as { passcode?: unknown };
    const passcode = typeof payload.passcode === "string" ? payload.passcode : "";
    if (!passcode || passcode.length > 256 || !safeEqual(passcode, appPasscode())) {
      return NextResponse.json({ success: false, error: "Incorrect passcode." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    const session = await getSession();
    session.isLoggedIn = true;
    await session.save();
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Authentication failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, error: "Authentication is unavailable." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
