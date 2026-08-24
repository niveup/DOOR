# Restore procedure (GA-112)

Backups are weekly JSON snapshots of every Postgres table, stored in the
Cloudflare D1 `backups` table (one immutable row per week, id `full-YYYY-MM-DD`).
Private journal content is NOT in these snapshots — it already lives encrypted
in D1 and never touches Postgres.

## 1. Fetch the latest snapshot

```powershell
cd backend
node ../scripts/backup-fetch.mjs > backup.json
```

The script signs the request with `CF_JOURNAL_STORE_URL` / `CF_JOURNAL_STORE_SECRET`
(same env vars as the app) and writes the newest snapshot to stdout.

## 2. Restore into Postgres

```powershell
node ../scripts/backup-restore.mjs backup.json          # adds missing rows
node ../scripts/backup-restore.mjs backup.json --replace # wipes tables first
```

`--replace` deletes each restored table's rows before re-inserting. Review the
script before using it — restore is a deliberate act.

## 3. Verify

Open the app and spot-check Finance + Tracker + Dashboard totals against the
`exportedAt` timestamp inside the snapshot.
