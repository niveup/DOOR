# Vercel deployment

The Next.js frontend deploys to Vercel. The Express/Prisma worker remains on a persistent Node host such as Render because it owns cron work, database migrations, and long AI requests.

## Import settings

1. Import `niveup/DOOR` in Vercel.
2. Set **Root Directory** to `frontend`.
3. Framework preset: **Next.js** (auto-detected).
4. The committed `frontend/vercel.json` supplies install/build/function settings.

## Required Vercel environment variables

Set these for Production, Preview, and Development:

- `SESSION_SECRET`: at least 32 random characters.
- `APP_PASSCODE`: at least 8 characters; must match the backend value.
- `NEXT_PUBLIC_API_URL`: `/api/backend`.
- `BACKEND_API_URL`: absolute deployed **HTTPS** backend origin, no trailing slash.
- `JOURNAL_PASSCODE`: a separate 12+ character passcode for opening the journal.
- `JOURNAL_ENCRYPTION_KEY`: a unique 32+ character secret that encrypts journal payloads before D1 storage. Do not reuse `SESSION_SECRET`.
- `CF_JOURNAL_STORE_URL`: the deployed HTTPS URL of `cloudflare/journal-store`.
- `CF_JOURNAL_STORE_SECRET`: a unique 32+ character HMAC secret shared only with the journal Worker and backend.

Optional development variable:

- `NEXT_PUBLIC_DEV_ORIGINS`: `localhost:3000`.

## Private journal / Cloudflare D1

Deploy `cloudflare/journal-store` first by following its [setup guide](cloudflare/journal-store/README.md). D1 receives only AES-256-GCM ciphertext; neither the browser nor the Worker holds the encryption key. Add the same `JOURNAL_ENCRYPTION_KEY`, `CF_JOURNAL_STORE_URL`, and `CF_JOURNAL_STORE_SECRET` to Render so the planner can read journal context server-to-server.

## Backend contract

The backend must be live before testing the UI and expose `GET /health`. Set the same `APP_PASSCODE` there. Its database and AI-provider variables remain backend-only.

## Smoke test after deploy

1. Open `/passcode`; wrong passcodes return 401, the correct one opens `/dashboard`.
2. Open `/api/backend/health` after login and confirm HTTP 200.
3. Load Dashboard, Journal, Explainer, Tracker, and Interview.
4. Open Journal: it must request the second passcode, then lock again after the configured period.
5. Submit one journal entry, confirm feedback renders, and confirm the Worker has a ciphertext (not readable entry text) in D1.
6. Submit one interview answer and test at 1440px, 390px, and 360px.

Never place provider keys, database URLs, or the backend passcode in variables prefixed with `NEXT_PUBLIC_`.
