import { test } from "node:test";
import assert from "node:assert/strict";
import { getKolkataDate, getKolkataHour, getKolkataMonday, getKolkataDateString } from "../src/lib/time.ts";

test("getKolkataDateString rolls the calendar day at the IST boundary", () => {
  // 2026-01-01T20:00:00Z is 2026-01-02 01:30 IST -> next day
  assert.equal(getKolkataDateString(new Date("2026-01-01T20:00:00Z")), "2026-01-02");
  // 2026-01-01T10:00:00Z is 15:30 IST -> same day
  assert.equal(getKolkataDateString(new Date("2026-01-01T10:00:00Z")), "2026-01-01");
});

test("getKolkataDate returns UTC midnight of the IST calendar day", () => {
  const d = getKolkataDate(new Date("2026-06-15T21:30:00Z")); // 2026-06-16 03:00 IST
  assert.equal(d.toISOString().slice(0, 10), "2026-06-16");
});

test("getKolkataMonday always lands on a Monday and matches known weeks", () => {
  const m = getKolkataMonday(new Date("2026-08-19T12:00:00Z")); // a Wednesday
  assert.equal(m.getUTCDay(), 1);
  assert.equal(m.toISOString().slice(0, 10), "2026-08-17"); // Mon of that week
  const sundayCase = getKolkataMonday(new Date("2026-08-16T18:00:00Z")); // Sunday 23:30 IST
  assert.equal(sundayCase.toISOString().slice(0, 10), "2026-08-10"); // Sunday rolls to previous week
});

test("getKolkataHour converts UTC hours into IST hours", () => {
  assert.equal(getKolkataHour(new Date("2026-03-10T10:00:00Z")), 15); // 15:30 IST
  assert.equal(getKolkataHour(new Date("2026-03-10T18:30:00Z")), 0);  // 00:00 IST next day
});
