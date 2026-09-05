# Project Rules

## Dark Mode Styling
- Do not make any style changes, overrides, or color adjustments to Dark Mode (`data-theme="dark"`) unless explicitly instructed by the user. Keep all dark mode components aligned strictly to the default dark theme tokens.

## Mobile App Server
- When the user asks to "open the mobile app server" or "start mobile server":
  - Directory: `d:\DOOR\mobile`
  - Preferred launcher script: `d:\DOOR\run_mobile.bat` (which runs `call npm start` in a cmd window) or command `npx expo start`
  - Health check: `http://localhost:8081/status` (returns `packager-status:running`)

## Codebase Architecture & Key Invariants
- **Full Architecture & Code Flow Guide**: Refer to [docs/CODEBASE_GUIDE.md](file:///d:/DOOR/docs/CODEBASE_GUIDE.md) for the end-to-end guide on topology, data flow, APIs, and module logic.
- **Topology**:
  - `frontend/` (Next.js 16, port 3000): UI + authenticated `/api/backend` proxy relay using `iron-session` (`app_session`).
  - `backend/` (Render, port 4000 external gateway `gateway.ts` proxying to port 4001 core `server.ts`).
  - `mobile/` (Expo React Native, port 8081): Native client hitting Express directly with `x-passcode`.
  - `cloudflare/journal-store/`: Cloudflare Worker + D1 storing AES-256-GCM encrypted journal entries, mirrored study logs, and backups.
  - `prisma/`: Supabase PostgreSQL schema (`Settings`, `Subject`, `Task`, `RoutinePlan`, `ProgressRating`, `StudyLog`, `FinanceExpense`, `FinanceBudget`, `FinanceBill`, etc.).
- **Security Invariants**:
  - Never expose `APP_PASSCODE`, `JOURNAL_ENCRYPTION_KEY`, or `CF_JOURNAL_STORE_SECRET` to browser clients.
  - Express routes use timing-safe passcode checks with rate-limiting and brute-force brakes (`lib/auth.ts`, `lib/rate-limit.ts`).
- **Data Invariants**:
  - The PostgreSQL `Journal` table is retired. Journal entries MUST be saved encrypted via `private-journal-store.ts` to Cloudflare D1.
  - Always use `Asia/Kolkata` timezone (`lib/time.ts`) for date math, scheduling, day keys, and streaks.
  - Bill payments (`/api/finance/bill/pay`) must atomically mark the bill paid and insert a linked expense (`bill-${id}`) inside a Prisma `$transaction`.
  - AI responses should be parsed via `jsonrepair` with fallback retry handling.
