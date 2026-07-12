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
- `BACKEND_API_URL`: absolute deployed backend origin, no trailing slash.

Optional development variable:

- `NEXT_PUBLIC_DEV_ORIGINS`: `localhost:3000`.

## Backend contract

The backend must be live before testing the UI and expose `GET /health`. Set the same `APP_PASSCODE` there. Its database and AI-provider variables remain backend-only.

## Smoke test after deploy

1. Open `/passcode`; wrong passcodes return 401, the correct one opens `/dashboard`.
2. Open `/api/backend/health` after login and confirm HTTP 200.
3. Load Dashboard, Journal, Explainer, Tracker, and Interview.
4. Submit one journal entry and one interview answer.
5. Test at 1440px, 390px, and 360px.

Never place provider keys, database URLs, or the backend passcode in variables prefixed with `NEXT_PUBLIC_`.
