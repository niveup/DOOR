import { NextRequest, NextResponse } from "next/server";
import { appPasscode, backendApiUrl } from "@/lib/env";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pure authenticated proxy: every request forwards to the Express backend on
// Render, which is the single writer for tracker, routine and finance data.
// The former in-relay Prisma handlers (handleNativeTrackerRoute /
// handleNativeFinanceRoute) were removed so domain logic exists in exactly one
// place — see AUDIT finding F-ARC-1 (GA-104).

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 110_000;
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control", "etag", "last-modified"] as const;
type RouteContext = { params: Promise<{ path: string[] }> };

async function relay(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await context.params;
  // Legacy journal endpoints are retired: private journal persistence lives in
  // the encrypted Cloudflare D1 store, never in Postgres.
  if (path[0] === "api" && path[1] === "journal") {
    return NextResponse.json(
      { error: "Use the private journal route." },
      { status: 404, headers: { "Cache-Control": "no-store, private, max-age=0" } }
    );
  }

  const safePath = path.map(encodeURIComponent).join("/");

  let bodyBuffer: ArrayBuffer | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    try {
      bodyBuffer = await request.arrayBuffer();
      if (bodyBuffer.byteLength > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
      }
      if (bodyBuffer.byteLength === 0) bodyBuffer = undefined;
    } catch {
      bodyBuffer = undefined;
    }
  }

  let baseUrl: string;
  let passcode: string;
  try {
    baseUrl = backendApiUrl();
    passcode = appPasscode();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json(
      { error: "Backend relay is not configured.", details: message },
      { status: 503 }
    );
  }

  const target = new URL(`${baseUrl}/${safePath}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const headers = new Headers({ accept: "application/json", "x-passcode": passcode });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: bodyBuffer,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    const responseHeaders = new Headers({ "x-content-type-options": "nosniff" });
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    const errMessage = error instanceof Error ? error.message : "network error";
    return NextResponse.json(
      { error: timedOut ? "Backend request timed out." : "Backend is unavailable.", details: errMessage },
      { status: timedOut ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = relay;
export const POST = relay;
export const PUT = relay;
export const PATCH = relay;
export const DELETE = relay;
