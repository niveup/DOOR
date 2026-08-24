import { test } from "node:test";
import assert from "node:assert/strict";
import { backupWeekOf } from "../src/lib/time.ts";

// backup-store pulls prisma + tracker-store; test the pure date logic here
// and the bundle shape via a stubbed collector in integration later.
test("backupWeekOf returns the IST calendar date as the snapshot id suffix", () => {
  assert.equal(backupWeekOf(new Date("2026-08-22T10:00:00Z")), "2026-08-22");
  assert.equal(backupWeekOf(new Date("2026-08-22T20:30:00Z")), "2026-08-23");
});
