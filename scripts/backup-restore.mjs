#!/usr/bin/env node
// Restore a backup snapshot (from backup-fetch.mjs) into Postgres.
// Usage: node scripts/backup-restore.mjs backup.json [--replace]
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const [file, flag] = process.argv.slice(2);
if (!file) { console.error("Usage: node scripts/backup-restore.mjs <snapshot.json> [--replace]"); process.exit(1); }

const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
const tables = snapshot.tables || {};
const prisma = new PrismaClient();
const order = ["settings", "subject", "financeBudget", "routinePlan", "task", "progressRating",
  "topicStatus", "weeklyReport", "studyLog", "financeExpense", "financeBill", "interviewAttempt"];
const childFirst = [...order].reverse();

for (const name of childFirst) {
  const rows = tables[name];
  if (!Array.isArray(rows)) continue;
  if (flag === "--replace") {
    await prisma[name].deleteMany({});
    console.log(`cleared ${name}`);
  }
}
for (const name of order) {
  const rows = tables[name];
  if (!Array.isArray(rows) || rows.length === 0) continue;
  for (const row of rows) {
    const idKeys = Object.keys(row).filter((k) => k.endsWith("Id") || k === "id");
    const where = {};
    for (const k of idKeys) where[k] = row[k];
    await prisma[name].upsert({ where, update: row, create: row }).catch(async () => {
      await prisma[name].create({ data: row });
    });
  }
  console.log(`restored ${name}: ${rows.length} rows`);
}
await prisma.$disconnect();
console.log("restore complete.");
