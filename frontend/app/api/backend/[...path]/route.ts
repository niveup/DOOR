import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 95_000;
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "etag",
  "last-modified",
] as const;

type RouteContext = { params: Promise<{ path: string[] }> };

function backendConfiguration() {
  const baseUrl = process.env.BACKEND_API_URL;
  const passcode = process.env.APP_PASSCODE;

  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
    throw new Error("BACKEND_API_URL must be an absolute http(s) URL.");
  }
  if (!passcode || passcode.length < 8) {
    throw new Error("APP_PASSCODE must be set and at least 8 characters.");
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), passcode };
}

async function relay(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let config: ReturnType<typeof backendConfiguration>;
  try {
    config = backendConfiguration();
  } catch (error) {
    console.error("Backend relay configuration error", error);
    return NextResponse.json(
      { error: "Backend relay is not configured." },
      { status: 500 }
    );
  }

  const { path } = await context.params;
  const safePath = path.map(encodeURIComponent).join("/");
  const target = new URL(`${config.baseUrl}/${safePath}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");
  // Always overwrite the browser-supplied value. Existing clients still send
  // x-passcode: 1234, but it never reaches the backend through this relay.
  headers.set("x-passcode", config.passcode);

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });

    const responseHeaders = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("x-content-type-options", "nosniff");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    console.error("Backend relay failed", timedOut ? "timeout" : error);
    return NextResponse.json(
      { error: timedOut ? "Backend request timed out." : "Backend is unavailable." },
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
