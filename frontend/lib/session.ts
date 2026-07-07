import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isLoggedIn?: boolean;
}

// Secrets must never fall back to a public default. A default password shipped
// in the repo means anyone can forge a valid session cookie, and (because the
// AI credential encryption key is derived from SESSION_SECRET) it also weakens
// the encryption protecting stored provider API keys. Fail loud instead.
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be set and at least 32 characters long."
  );
}

export const sessionOptions = {
  password: sessionSecret,
  cookieName: "jujum_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}
