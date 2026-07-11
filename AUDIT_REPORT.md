# Audit Report — 2026-07-11

Audited scope: every file under `frontend/`, `backend/`, and `prisma/` (59 files; 877,979 bytes), plus `PRD.md`. Text files were decoded and inspected; binary assets and lockfiles were read and hashed. This report audits source commit `2f10561cadcc932120afe07bec8231c2ad752844`.

Static fetch inventory checked:

- `frontend/app/dashboard/page.tsx:170` → ``${backendUrl}/api/routine/today``
- `frontend/app/dashboard/page.tsx:189` → ``${backendUrl}/api/tracker/status``
- `frontend/app/dashboard/page.tsx:235` → ``${backendUrl}/api/tasks/${taskId}/status``
- `frontend/app/dashboard/page.tsx:312` → ``${backendUrl}/api/routine/plan-chat``
- `frontend/app/dashboard/page.tsx:361` → ``${backendUrl}/api/routine/manual``
- `frontend/app/dashboard/page.tsx:394` → ``${backendUrl}/api/routine/manual``
- `frontend/app/dashboard/page.tsx:436` → ``${backendUrl}/api/routine/today``
- `frontend/app/explainer/page.tsx:390` → ``${backendUrl}/api/explainer/query``
- `frontend/app/interview/page.tsx:88` → ``${backendUrl}/api/interview/evaluate``
- `frontend/app/journal/page.tsx:43` → ``${backendUrl}/api/journal/history?limit=30``
- `frontend/app/journal/page.tsx:60` → ``${backendUrl}/api/journal``
- `frontend/app/passcode/page.tsx:23` → `"/api/auth"`
- `frontend/app/settings/ai/page.tsx:50` → ``${backendUrl}/api/ai/models?provider=${nextProvider}``
- `frontend/app/settings/ai/page.tsx:63` → ``${backendUrl}/api/ai/config``
- `frontend/app/settings/ai/page.tsx:103` → ``${backendUrl}/api/ai/config``
- `frontend/app/settings/ai/page.tsx:129` → ``${backendUrl}/api/ai/test``
- `frontend/app/tracker/page.tsx:32` → ``${backendUrl}/api/tracker/status``
- `frontend/app/tracker/page.tsx:51` → ``${backendUrl}/api/tracker/rating``

## Critical
- [ ] **Concept Explainer promotes off-scope computer-science topics** — `frontend/app/explainer/page.tsx:56` — The PRD defines a GATE Mechanical explainer, but first-run suggestions advertise heap memory, stack/queue, and binary search; this contradicts the stated scope and weak-subject loop. — **Fix pass:** Replace suggestions and validation with the seeded GATE ME subject/topic catalog or explicitly broaden the product scope.
- [ ] **Interview skips/timeouts are presented as session progress but are never persisted** — `frontend/app/interview/page.tsx:111` — The counter advances locally while InterviewAttempt has a `skipped` field that the visible flow never writes. — **Fix pass:** Persist skips with the active session and question index, including Rapid Fire timeout advances.
- [ ] **Interview answers cannot form a real five-question session** — `backend/src/gateway.ts:170` — Every evaluation receives a fresh sessionId and questionIndex 0, so the persisted rows cannot be grouped or ordered into the PRD session summary. — **Fix pass:** Send a stable sessionId/questionIndex from the client, validate them, and compute a session total.
- [ ] **Progress Tracker never produces the PRD seven-section AI analysis** — `backend/src/server.ts:1604` — Tracker routes calculate/read ratings but do not call the AI for weak/strong/neglected subjects, recommended topics, weekly plan, readiness, and avoidance warnings as one analysis. — **Fix pass:** Add a logged, retrying analysis endpoint or remove the AI-analysis claim from the product.
- [ ] **Journal backend does not enforce the PRD 5000-character maximum** — `backend/src/server.ts:448` — The browser caps input, but direct API callers can submit unbounded journal text into storage and AI context. — **Fix pass:** Add server-side max-length validation and a request-size bound.
- [ ] **Dashboard displays fixture tasks when no real plan exists** — `frontend/app/dashboard/page.tsx:64` — The empty dashboard shows realistic sample tasks, which can be mistaken for a generated/persisted plan. — **Fix pass:** Use an explicit EmptyState or label the data unmistakably as a preview.
- [ ] **Journal stores only part of the five-part AI response** — `backend/src/server.ts:537` — The parser stores part 1 as `aiFeedback`, part 3 as pattern, and part 4 as task; parts 2 and 5 are not persisted in the feedback field even though the PRD defines one five-part response. — **Fix pass:** Persist the complete mentor response and parse structured fields separately with validation/retry.
- [ ] **Comeback push-alert data exists but notification delivery is absent** — `prisma/schema.prisma:26` — The PRD requires day-3/day-5/day-7 alerts; the subscription field is defined but no backend read/write or push sender is present. — **Fix pass:** Add subscription management and idempotent scheduled notification delivery.

## Consistency gaps
- [ ] **Interview AI reliability is implemented in gateway.ts rather than the shared server AI layer** — `backend/src/gateway.ts:102` — The endpoint correctly extracts, retries, logs, and persists, but duplicates credential resolution/validation logic outside server.ts; future endpoints can drift. — **Fix pass:** Extract one shared AI structured-output service and import it from both gateway and core routes.
- [ ] **AI endpoint `/api/ai/test` does not use the complete shared reliability pattern** — `backend/src/server.ts:384` — Missing: strict retry attempt, aiCallLog logging. — **Fix pass:** Standardize extraction, schema validation, one strict retry, and logging in a shared helper.
- [ ] **AI endpoint `/api/journal` does not use the complete shared reliability pattern** — `backend/src/server.ts:443` — Missing: shared robust JSON extraction, strict retry attempt. — **Fix pass:** Standardize extraction, schema validation, one strict retry, and logging in a shared helper.
- [ ] **AI endpoint `/api/routine/plan-chat` does not use the complete shared reliability pattern** — `backend/src/server.ts:689` — Missing: shared robust JSON extraction, strict retry attempt, aiCallLog logging. — **Fix pass:** Standardize extraction, schema validation, one strict retry, and logging in a shared helper.

## Security / configuration
- [ ] **Gateway CORS has a hardcoded production fallback origin** — `backend/src/gateway.ts:15` — The external gateway uses an explicit allowlist, but silently falls back to `https://jujum.vercel.app`; renamed preview/production domains will fail until configured. — **Fix pass:** Document and require ALLOWED_ORIGINS in production, with localhost defaults only in development.
- [ ] **Environment variable `ALLOWED_ORIGINS` is undocumented** — `backend/src/gateway.ts:15` — It is read in code but absent from both example env files. — **Fix pass:** Document scope, required format, and safe deployment value.
- [ ] **Environment variable `INTERNAL_API_PORT` is undocumented** — `backend/src/gateway.ts:12` — It is read in code but absent from both example env files. — **Fix pass:** Document scope, required format, and safe deployment value.
- [ ] **Environment variable `NODE_ENV` is undocumented** — `frontend/lib/session.ts:23` — It is read in code but absent from both example env files. — **Fix pass:** Document scope, required format, and safe deployment value.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/dashboard/page.tsx:171` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/dashboard/page.tsx:190` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/dashboard/page.tsx:239` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/dashboard/page.tsx:316` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/dashboard/page.tsx:365` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/dashboard/page.tsx:398` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/dashboard/page.tsx:438` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/explainer/page.tsx:394` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/interview/page.tsx:90` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/journal/page.tsx:43` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/journal/page.tsx:61` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/settings/ai/page.tsx:51` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/settings/ai/page.tsx:64` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/settings/ai/page.tsx:107` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/settings/ai/page.tsx:133` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/tracker/page.tsx:32` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/app/tracker/page.tsx:51` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/components/ModelSelector.tsx:48` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `frontend/components/ModelSelector.tsx:62` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Hardcoded passcode-shaped value** — `backend/src/server.ts:236` — `"1234"` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.
- [ ] **Production CORS accepts broad private-network origins** — `backend/src/server.ts:41` — Any matching private-network origin is accepted regardless of environment, while the deployed Vercel origin is separately hardcoded. — **Fix pass:** Build the allowlist from explicit env values; permit LAN patterns only in development.
- [ ] **Backend authentication fails open to the published default `1234`** — `backend/src/server.ts:236` — A missing Render env value activates a known credential. — **Fix pass:** Require a strong env secret at startup and use constant-time comparison.
- [ ] **Cron secret is accepted in the query string** — `backend/src/server.ts:230` — URLs leak through logs, histories, and monitoring more readily than headers. — **Fix pass:** Accept the cron secret only via a dedicated header and redact failures.

## Data model
- [ ] **No calendar-date or required business-key constraint issue found** — `prisma/schema.prisma:42` — Journal.date, RoutinePlan.date, ProgressRating.weekStartDate, and WeeklyReport.weekStartDate use `@db.Date`; the one-per-day/week keys are enforced with `@unique`/`@@unique`. — **Fix pass:** No fix; retain these constraints during future migrations.
- [ ] **Half-point interview totals are rounded before persistence** — `backend/src/gateway.ts:177` — The API can return 0.5 increments, but InterviewAttempt.score is Int and stores a rounded value, so durable history disagrees with what the user saw. — **Fix pass:** Use a Float/Decimal score or constrain all displayed totals to integers.
- [ ] **`TopicStatus` is not read and not written by traced application code** — `prisma/schema.prisma:107` — The table is dead in the current implementation. — **Fix pass:** Wire the missing lifecycle operation or remove/defer the model.
- [ ] **`WeeklyReport` is not read and not written by traced application code** — `prisma/schema.prisma:120` — The table is dead in the current implementation. — **Fix pass:** Wire the missing lifecycle operation or remove/defer the model.
- [ ] **`ConceptExplanation` is not read by traced application code** — `prisma/schema.prisma:159` — The table is one-way in the current implementation. — **Fix pass:** Wire the missing lifecycle operation or remove/defer the model.
- [ ] **`InterviewAttempt` is not read by traced application code** — `prisma/schema.prisma:175` — The table is one-way in the current implementation. — **Fix pass:** Wire the missing lifecycle operation or remove/defer the model.

## AI prompts
- [ ] **Journal prompt and parser agree only on fragile delimiters** — `backend/prompts/journal.md:16` — The prompt requests five natural-language sections while code splits raw text without validating section count or labels. — **Fix pass:** Return schema-constrained JSON or validate five sections and retry strictly.

## Cron / scheduled logic
- [ ] **Cron touchpoint missing or not provable: 22:00 reminder** — `backend/src/server.ts:1065` — The `/cron/tick` block does not contain all identifying logic for this PRD touchpoint. — **Fix pass:** Implement the action with a persisted run marker and explicit timezone handling.
- [ ] **Cron touchpoint missing or not provable: Sunday weekly report** — `backend/src/server.ts:1065` — The `/cron/tick` block does not contain all identifying logic for this PRD touchpoint. — **Fix pass:** Implement the action with a persisted run marker and explicit timezone handling.

## Mobile / accessibility / dead code
- [ ] **Merged global stylesheet contains no page-level phone layout** — `frontend/app/globals.css:386` — The current file ends after generic component/toast rules; there is no 360–390px navigation/content adaptation despite daily Android use. — **Fix pass:** Add and verify a fixed five-tab bottom bar, safe-area padding, and stacked dense layouts.
- [ ] **Shared stylesheet has no requested mobile breakpoint** — `frontend/app/globals.css:3` — No `@media (max-width: 900px)` treatment exists. — **Fix pass:** Add page-shell and dense-content adaptations, then test 360/390px.
- [ ] **Dense horizontally scrolling content needs 360px verification** — `frontend/app/explainer/page.tsx:968` — The page uses minimum widths inside horizontal overflow; controls or essential data may be hidden on a phone. — **Fix pass:** Provide a stacked/mobile representation or prove scrolling is deliberate and announced.
- [ ] **console.log debug statement** — `backend/src/debug_logs.ts:12` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/debug_logs.ts:13` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/debug_logs.ts:14` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/debug_logs.ts:15` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/debug_logs.ts:16` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/debug_logs.ts:17` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/debug_logs.ts:19` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/gateway.ts:227` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/lib/ai/provider.ts:61` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/seed.ts:201` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/seed.ts:238` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:27` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:29` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:34` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:50` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:57` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:1072` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:1125` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:1349` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:1379` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:1389` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:1467` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.
- [ ] **console.log debug statement** — `backend/src/server.ts:1680` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.

## Type errors (raw tsc output)
### Frontend (`npx tsc --noEmit`, exit `0`)
```text
(no output)
```

### Backend (`npx tsc --noEmit`, exit `0`)
```text
(no output)
```

## Audited file manifest
Every scoped file read in this pass (size and SHA-256):
- `frontend/.env.example` — 752 bytes — `f0b142788edb504ab28559f431f5e2707936e80f32a479cf8dd883614635230c`
- `frontend/.gitignore` — 480 bytes — `207e265ff4901f9ad9f96d8ce08530e04f9fc600815472a66d0a446096d654cd`
- `frontend/AGENTS.md` — 327 bytes — `e3447d84251880fb34cfae09131cb4c57471529bbfe60976a3245793cf621627`
- `frontend/CLAUDE.md` — 11 bytes — `336cc4fbf19beaada7ccf9986414fa91851a8d7a07dfb3ccbe800a69eed0ab49`
- `frontend/README.md` — 1287 bytes — `8653e30ae64e984f18e85fb2a0fe239f2e7549e0fb6cd2b19a772655def776cb`
- `frontend/app/api/auth/route.ts` — 2896 bytes — `dc8bdbefd322c11308e497ba82792fe257da2aee47248a19ce7889b30285707f`
- `frontend/app/api/backend/[...path]/route.ts` — 3764 bytes — `708ffb4d0f32f619c21271b875d3f6ef7e279553f98c45298ee7a3960971cb55`
- `frontend/app/dashboard/page.tsx` — 41099 bytes — `21dd303bd7790fa8db864515c686b7047874281b56f10cc5625fe17a3f27a6e1`
- `frontend/app/explainer/page.tsx` — 56193 bytes — `ac22260e6d81dd106f11b1279b4ea43cf78dcf289fd7440dd940b5e218b76213`
- `frontend/app/favicon.ico` — 25931 bytes — `2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932`
- `frontend/app/globals.css` — 8055 bytes — `3c8f324720153a57b3fb7f2b71a482b0f3670ba9bda0d853dd617f3e54b26a7a`
- `frontend/app/interview/page.tsx` — 12335 bytes — `f79825932505b079ca733dfc8850135d535100b8a3228397d5f6762a9b58b11d`
- `frontend/app/journal/page.tsx` — 11113 bytes — `d08901383cdb1411efb3a15eb310133888ce84999cfa1e4081a705abb2174f41`
- `frontend/app/layout.tsx` — 1267 bytes — `e3460578609ecf8b2b33a56bd32d20669f1b77d91aeea25abeb1776a36733f03`
- `frontend/app/page.tsx` — 106 bytes — `832b647cd752da7f0ad0313ca426a04bfd851d972467bb003294a99b4caefde7`
- `frontend/app/passcode/page.tsx` — 5408 bytes — `bb11a162ffe2aa909853defef898715bcf47218bebd8e5a7f60052fb07fe2879`
- `frontend/app/settings/ai/page.tsx` — 10233 bytes — `2ba509e667c63e59ac7d03bbba12e3b573a92a1fc8ce468ca64f8ba5fce35eed`
- `frontend/app/template.tsx` — 552 bytes — `6454ea0a468f5c3264e190dcbd131dd9cb9f6c4a9be7dc191095ea6f39aca35e`
- `frontend/app/tracker/page.tsx` — 12629 bytes — `ecfffe0abec25c9511d3d2811f672d80aee320e2b4dac73edea0fbf3995cbbf8`
- `frontend/components/AiMarkdown.tsx` — 40096 bytes — `22d3b9cd2500cf9618bde8e570f90974bcbeb9249e87c8a62ca5ba0644aec12a`
- `frontend/components/AppShell.tsx` — 7349 bytes — `07ab78c89f7b2db73b351497ca80dd71e7b7b7fc2aaac1841863248e9130b136`
- `frontend/components/ModelSelector.tsx` — 5047 bytes — `a6fa35c62efa833b54bef19589629517729d7aa8c1c0e838cfe4bfa7c1e95dcd`
- `frontend/components/MotionComponents.tsx` — 7342 bytes — `37e18c8a42162786722144fb7f2317d3b4d535e95192ee3d5d2c1282049fc43a`
- `frontend/eslint.config.mjs` — 465 bytes — `870f1adccecf3051cbcd9fd307cef51d7633cf510979c181a81f4b1797273493`
- `frontend/lib/config.ts` — 454 bytes — `b3d3b8f7bfd8b2ddc2d10f5141ab5b0fa1ff9e71a05cbf3ea7abe628e3500e60`
- `frontend/lib/session.ts` — 1090 bytes — `874aecb36d4879e3e36eb927b8c58c18645eb158ffd4e2e2937b27c93ab6418e`
- `frontend/next.config.ts` — 2269 bytes — `93e51aacce95630fff35df10387e1f8d3715b42e17af1acf7d25ef95f71fdcfa`
- `frontend/package-lock.json` — 306817 bytes — `0797512009f76a2e0714ad82f2a5842177676dc40d93f675ecf93ac4b16d2a11`
- `frontend/package.json` — 754 bytes — `5bb740d6026c7eff99d9b94efefde30fd4837f8a8f78d58bd148d8e2a8398faa`
- `frontend/postcss.config.mjs` — 94 bytes — `dfac7ac2d86d326a0e5adb024e7943c181393ed17a5fcb8f0315b24c7da6ddde`
- `frontend/proxy.ts` — 996 bytes — `c36afb25af31f8b36adbe21de91d3ede4d0d6aa321a2e9a7048f05d353803bd2`
- `frontend/public/file.svg` — 391 bytes — `2b67812c325c199a02536cdbeea0c593a72f707d323b72ee3e08dbab06753bd4`
- `frontend/public/globe.svg` — 1035 bytes — `b614b9bf183925957661ac851498fe1d8029fd43a62fbfed86f9e2624a57e7cf`
- `frontend/public/next.svg` — 1375 bytes — `55995dfad6ecb4945a1e856ddca03c5e16aa5bf13fd21b4df6a74ae79357bcfc`
- `frontend/public/vercel.svg` — 128 bytes — `f081337b2fee635b455b63275406a3e7f39d6a014e25ad90dab5a67e62a12ac4`
- `frontend/public/window.svg` — 385 bytes — `644768c4aaeb4767bce293344eeb0c125fb804a94d801440424072202d85e3a1`
- `frontend/tsconfig.json` — 666 bytes — `be18523b23b78b6e1a876ddd107d330f0168bddf09d751b57e0b5edce69c66f3`
- `frontend/tsconfig.tsbuildinfo` — 119627 bytes — `68f78fc8a3747e8f843d28653dd4e03ff35a8d3afc49ceb986ef349860d57f9b`
- `frontend/types/katex-auto-render.d.ts` — 271 bytes — `891297ead96491161ceed521e6696b800fbd4bb3f3f709799567869363d1511b`
- `backend/.env.example` — 872 bytes — `3c49f84964383f7d194b7734dbf331ba6fbd25f028e76dc8b6054fc5f87877e5`
- `backend/package-lock.json` — 71628 bytes — `122a8f7654d816ad9c4f661b3be69fa59f40d4fe7a03bc68bb5244d2f44c7e3b`
- `backend/package.json` — 1012 bytes — `f547f4b42241e7999f7b36eecba9b16dbf8a19a8c3d7f90bb42ade9ca467e265`
- `backend/prompts/_preamble.md` — 1774 bytes — `5da50af83179761fc2867de52fe6a94b811997515efa0d0212eff4679674f283`
- `backend/prompts/explainer.md` — 9251 bytes — `5e7e16050dfaec16b879acae7530b8451af767788e6a04c810577443c38fb1b7`
- `backend/prompts/journal.md` — 1694 bytes — `1d6f80443104c56f7685dc63e782bf25e08c7a7f98b0c1a8d3ed74519120dcb5`
- `backend/prompts/plan_chat.md` — 1713 bytes — `4803ad7c2f49b562cfdc907092e7fe0f410b90d008d92ca6f2c823075be900b6`
- `backend/prompts/routine_plan.md` — 1500 bytes — `64533948ad66edb343f897091b6622a66f77372c7b28397243bc48042e0e2c58`
- `backend/src/debug_logs.ts` — 628 bytes — `a9a5d2f0a576d7a24536b4382179b98ab4592d169d10b909077cdf126f158831`
- `backend/src/gateway.ts` — 9839 bytes — `74e1a071eef494739dfe1ca0b6b61f3fa88deb650f491a79192aeb34e95591fe`
- `backend/src/lib/ai/credentials.ts` — 1552 bytes — `df2948956ecafd0bf793b07c46cfb593283c16d7e015aae468548a1d80d573a6`
- `backend/src/lib/ai/provider.ts` — 2706 bytes — `4fd9db1f8bbe4d0ee4bbafa69e797d24518d0e8590b46171bb080904e1658fa1`
- `backend/src/seed.ts` — 6094 bytes — `9bb5798754210f81a8a55a66b4a8f9531c5dba891ef8ab1f9d061dde0b0ec99d`
- `backend/src/server.ts` — 62047 bytes — `77dca7c139967eebe9d7aae884fe9b43a099281cf7b193bacdd1e2deb9f3e65d`
- `backend/tsconfig.json` — 276 bytes — `1802e83b1d614d55820dde4fdc3816b160cc2069dd502e3d4d6b647ef2e62628`
- `prisma/migrations/20260630061539_init/migration.sql` — 5695 bytes — `699d1a22aeb495f071591c96b2ba61bcd02e7a181f4d5ab4e5abffca582e0452`
- `prisma/migrations/20260701023325_add_explainer_interview/migration.sql` — 1408 bytes — `14d9af45af7a83047e4af17405fe13a9032e8b50ec5a9a0e7887d7cb8d651a81`
- `prisma/migrations/20260706090000_add_encrypted_ai_credentials/migration.sql` — 536 bytes — `17339a44b6c7a50804ae8757df040b5517d1dfd5f564421868454dea125d65fa`
- `prisma/migrations/migration_lock.toml` — 126 bytes — `693566b52c49db47a2b0901d12400aa3d710d13a49f4a2a154b80c0505ed737c`
- `prisma/schema.prisma` — 6539 bytes — `085d5914bb5147807d74b0bc165022317efe6d447244ebd19206109d078b3de6`
