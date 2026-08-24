/**
 * Asia/Kolkata timezone helpers — the single shared copy (audit GA-114:
 * previously duplicated across server.ts, gateway.ts and the Vercel relay).
 * All date math for scheduling, streaks and day keys flows through these.
 */

export function getKolkataDate(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const dateString = formatter.format(date); // YYYY-MM-DD
  return new Date(dateString);
}

export function getKolkataMonday(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const dateString = formatter.format(date);
  const parts = dateString.split("-").map(Number);
  const kolkataDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const day = kolkataDate.getUTCDay();
  const diff = kolkataDate.getUTCDate() - day + (day === 0 ? -6 : 1);
  kolkataDate.setUTCDate(diff);
  return kolkataDate;
}

export function getKolkataHour(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false
  });
  return parseInt(formatter.format(date), 10);
}

export function getKolkataDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function backupWeekOf(now: Date = new Date()): string {
  return getKolkataDateString(now);
}
