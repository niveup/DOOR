const MIN_SESSION_SECRET_LENGTH = 32;
const MIN_PASSCODE_LENGTH = 8;
const MIN_JOURNAL_PASSCODE_LENGTH = 12;

function required(name: string, value: string | undefined, minimum = 1) {
  if (!value || value.length < minimum) {
    throw new Error(`${name} is required and must be at least ${minimum} characters.`);
  }
  return value;
}

export function sessionSecret() {
  return required("SESSION_SECRET", process.env.SESSION_SECRET, MIN_SESSION_SECRET_LENGTH);
}

export function appPasscode() {
  return required("APP_PASSCODE", process.env.APP_PASSCODE, MIN_PASSCODE_LENGTH);
}

export function journalPasscode() {
  return required("JOURNAL_PASSCODE", process.env.JOURNAL_PASSCODE, MIN_JOURNAL_PASSCODE_LENGTH);
}

export function journalUnlockDurationMs() {
  const minutes = Number(process.env.JOURNAL_UNLOCK_DURATION_MINUTES || 15);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 60) {
    throw new Error("JOURNAL_UNLOCK_DURATION_MINUTES must be an integer from 5 to 60.");
  }
  return minutes * 60 * 1000;
}

export function backendApiUrl() {
  const value = required("BACKEND_API_URL", process.env.BACKEND_API_URL);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("BACKEND_API_URL must be an absolute http(s) URL.");
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error("BACKEND_API_URL must use http or https.");
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("BACKEND_API_URL must use HTTPS in production.");
  }
  return parsed.origin + parsed.pathname.replace(/\/$/, "");
}
