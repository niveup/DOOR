type Level = "info" | "warn" | "error";

function sanitize(value: unknown): unknown {
 if (value instanceof Error) return { name: value.name, message: value.message };
 if (typeof value === "string") return value.replace(/(api[_-]?key|passcode|secret|token)\s*[:=]\s*\S+/gi, "$1=[redacted]");
 return value;
}

function write(level: Level, event: string, ...details: unknown[]) {
 const payload = JSON.stringify({ level, event, details: details.map(sanitize), at: new Date().toISOString() });
 if (level === "error") console.error(payload);
 else if (level === "warn") console.warn(payload);
 else console.info(payload);
}

export const logger = {
 info: (event: string, ...details: unknown[]) => write("info", event, ...details),
 warn: (event: string, ...details: unknown[]) => write("warn", event, ...details),
 error: (event: string, ...details: unknown[]) => write("error", event, ...details),
};
