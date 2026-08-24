#!/usr/bin/env node
// Fetch the newest backup snapshot from the D1 journal-store worker.
// Requires CF_JOURNAL_STORE_URL and CF_JOURNAL_STORE_SECRET in backend/.env
import crypto from "node:crypto";
import fs from "node:fs";

const envFile = fs.readFileSync(new URL("../backend/.env", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}
const url = process.env.CF_JOURNAL_STORE_URL;
const secret = process.env.CF_JOURNAL_STORE_SECRET;
if (!url || !secret) { console.error("Missing CF_JOURNAL_STORE_URL/SECRET"); process.exit(1); }

const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.`).digest("base64url");

const res = await fetch(`${url.replace(/\/$/, "")}/v1/backups/latest`, {
  headers: { "X-Journal-Timestamp": timestamp, "X-Journal-Signature": signature },
});
const data = await res.json();
if (!data.backup) { console.error("No backups exist yet."); process.exit(1); }
console.log(`<!-- ${data.backup.id} week_of=${data.backup.week_of} -->`);
console.log(data.backup.payload);
