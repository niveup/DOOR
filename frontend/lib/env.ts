const MIN_SESSION_SECRET_LENGTH = 32;
const MIN_PASSCODE_LENGTH = 8;

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
  return parsed.origin + parsed.pathname.replace(/\/$/, "");
}
