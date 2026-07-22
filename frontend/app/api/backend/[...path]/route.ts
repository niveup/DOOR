import { NextRequest, NextResponse } from "next/server";
import { appPasscode, backendApiUrl } from "@/lib/env";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 110_000;
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control", "etag", "last-modified"] as const;
type RouteContext = { params: Promise<{ path: string[] }> };

async function relay(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let baseUrl: string;
  let passcode: string;
  try {
    baseUrl = backendApiUrl();
    passcode = appPasscode();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("Backend relay configuration error", message);
    return NextResponse.json({
      error: "Backend relay is not configured.",
      details: message,
      help: "Ensure BACKEND_API_URL and APP_PASSCODE environment variables are set in Vercel project settings.",
    }, { status: 503 });
  }

  const { path } = await context.params;
  // Journal contents only travel through /api/journal, which enforces the
  // separate journal lock and encrypted Cloudflare D1 storage boundary.
  if (path[0] === "api" && path[1] === "journal") {
    return NextResponse.json({ error: "Use the private journal route." }, {
      status: 404,
      headers: { "Cache-Control": "no-store, private, max-age=0" },
    });
  }
  const safePath = path.map(encodeURIComponent).join("/");
  const target = new URL(`${baseUrl}/${safePath}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });

  const headers = new Headers({ accept: "application/json", "x-passcode": passcode });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let body: ArrayBuffer | undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    let upstream = await fetch(target, { method: request.method, headers, body, cache: "no-store", redirect: "manual", signal: controller.signal });

    if (upstream.status === 404 && safePath === "api/tracker/log" && request.method === "POST") {
      try {
        const parsedBody = body ? JSON.parse(new TextDecoder().decode(body)) : {};
        const fallbackTarget = new URL(`${baseUrl}/api/tracker/rating`);
        const fallbackBody = JSON.stringify({
          subjectId: parsedBody.subjectId,
          selfRating: 3,
          hoursStudied: parsedBody.hoursStudied || 0,
          questionsSolved: parsedBody.questionsSolved || 0,
          notes: parsedBody.notes || null,
        });
        const fallbackHeaders = new Headers(headers);
        fallbackHeaders.set("content-type", "application/json");
        upstream = await fetch(fallbackTarget, {
          method: "POST",
          headers: fallbackHeaders,
          body: fallbackBody,
          cache: "no-store",
          redirect: "manual",
          signal: controller.signal,
        });
      } catch (fallbackErr) {
        console.error("Tracker log fallback failed:", fallbackErr);
      }
    } else if (upstream.status === 404 && safePath === "api/tracker/reset" && request.method === "POST") {
      return NextResponse.json({ success: true });
    }

    const responseHeaders = new Headers({ "x-content-type-options": "nosniff" });
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    const errMessage = error instanceof Error ? error.message : "network error";
    console.error("Backend relay failed", timedOut ? "timeout" : errMessage);
    return NextResponse.json({
      error: timedOut ? "Backend request timed out." : "Backend is unavailable.",
      details: errMessage,
      targetUrl: target.toString(),
    }, { status: timedOut ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = relay;
export const POST = relay;
export const PUT = relay;
export const PATCH = relay;
export const DELETE = relay;
