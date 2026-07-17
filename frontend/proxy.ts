import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { hasActiveJournalSession, sessionOptions } from "./lib/session";

// Next.js 16 renamed middleware.ts to proxy.ts. Keep this check cheap: it only
// verifies the signed, httpOnly session cookie and never calls a database.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<{ isLoggedIn?: boolean; journalUnlockedUntil?: number }>(
    request,
    response,
    sessionOptions
  );
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname.startsWith("/passcode") || pathname.startsWith("/api/auth")) {
    return response;
  }

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/passcode", request.url));
  }

  // The journal has a second, time-limited lock. This redirect is only an
  // optimistic guard; its page and API handlers enforce the same check.
  if (pathname === "/journal/unlock" || pathname.startsWith("/api/journal-auth")) {
    return response;
  }
  if ((pathname === "/journal" || pathname.startsWith("/journal/")) && !hasActiveJournalSession(session)) {
    return NextResponse.redirect(new URL("/journal/unlock", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
