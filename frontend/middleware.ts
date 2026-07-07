import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "./lib/session";

// NOTE: Next.js only executes middleware from a file named `middleware.ts`
// at the project root, exporting a function named `middleware`. The previous
// `proxy.ts` / `proxy()` was never invoked, so the passcode gate did nothing.
export async function middleware(request: NextRequest) {
  const res = NextResponse.next();

  const session = await getIronSession<{ isLoggedIn?: boolean }>(
    request,
    res,
    sessionOptions
  );

  const { pathname } = request.nextUrl;

  // Public resources, the passcode page, and the login API bypass the gate.
  if (
    pathname.startsWith("/passcode") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return res;
  }

  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL("/passcode", request.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
