import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "./lib/session";

// Next.js 16 renamed middleware.ts to proxy.ts. Keep this check cheap: it only
// verifies the signed, httpOnly session cookie and never calls a database.
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<{ isLoggedIn?: boolean }>(
    request,
    response,
    sessionOptions
  );
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/passcode") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return response;
  }

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/passcode", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
