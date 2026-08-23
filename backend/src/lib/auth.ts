import crypto from "crypto";

/**
 * Shared-secret gate used by the passcode middleware.
 * Kept as a pure module so the authentication decision is unit-testable
 * without booting the Express server.
 */
export function isPasscodeConfigured(expected: unknown): expected is string {
  return typeof expected === "string" && expected.length >= 8;
}

export function verifySharedSecret(received: string, expected: string): boolean {
  const a = crypto.createHash("sha256").update(received).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
