import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions } from "./lib/session";

export async function proxy(request: NextRequest) {
  const res = NextResponse.next();
  
  const session = await getIronSession<{ isLoggedIn?: boolean }>(
    request,
    res,
    sessionOptions
  );

  const { pathname } = request.nextUrl;
  console.log(`[Middleware] Path: ${pathname} | isLoggedIn: ${session.isLoggedIn}`);

  // Let public resources, passcode page, and login API bypass
  if (
    pathname.startsWith("/passcode") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return res;
  }

  // Redirect to passcode if not logged in
  if (!session.isLoggedIn) {
    console.log(`[Middleware] Redirecting ${pathname} to /passcode`);
    return NextResponse.redirect(new URL("/passcode", request.url));
  }

  console.log(`[Middleware] Allowing access to ${pathname}`);
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (unless it's an api path we want to protect)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
