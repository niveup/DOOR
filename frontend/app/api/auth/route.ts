import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { passcode } = (await request.json()) as { passcode?: string };

    // No public default. If APP_PASSCODE is unset, refuse all logins rather
    // than silently accepting "1234".
    const correctPasscode = process.env.APP_PASSCODE;
    if (!correctPasscode) {
      return NextResponse.json(
        { success: false, error: "Server is missing APP_PASSCODE configuration." },
        { status: 500 }
      );
    }

    if (passcode === correctPasscode) {
      const session = await getSession();
      session.isLoggedIn = true;
      await session.save();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Incorrect passcode" }, { status: 401 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
