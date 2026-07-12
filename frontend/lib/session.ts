import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/env";

export interface SessionData {
  isLoggedIn?: boolean;
}

export const sessionOptions = {
  password: sessionSecret(),
  cookieName: "jujum_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
