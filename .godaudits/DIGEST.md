# DOOR / Jujum AI — Audit Digest (shared context for all domain passes)

Commit d826add. Tree dirty (53 entries, mostly mobile/frontend UI redesign work uncommitted).
Static mode only. No execution authorized. LibreChat/** is VENDORED third-party (upstream chat server) — out of line-audit scope; only its integration/pinning posture is auditable. `.agents/`, `node_modules/`, lockfiles are not product code. Prior human audit exists: AUDIT_REPORT.md (2026-07-11 @ commit 2f10561) — check whether its findings still reproduce.

## Intake result (authoritative for this audit)
- Mode: fresh. plan_aware: false. Capabilities: static only.
- Primary form: web-application (frontend/app Next.js routes: api, chat, dashboard, explainer, finance, interview, journal, passcode, sandbox-chat, settings, tracker). Secondary: api-service (backend Express gateway+cron, cloudflare/journal-store worker), mobile-desktop (Expo/RN mobile/).
- Compatibility archetype (from EVIDENCE.json): api-service (Firm).
- Scale: side-project — single human contributor (niveup, 193 commits) + bot; CI = 3 GH workflows; deploys Render (render.yaml) + Vercel + Cloudflare wrangler. PRD.md v3.1 documents deliberate single-user free-tier scope ("No complex auth… no RLS… no compliance").
- Risk profile: balanced. Calibration note: security basics (secrets, injection) bind regardless of scale.
- Exclusions to record: seo (no public crawlable surface — root routes to passcode gate; verify before excluding), launch (no landing/marketing/channel surface; personal non-commercial scope per PRD §1.1/1.5).

## Architecture map (verified reads)
- backend/src/server.ts (~1600+ lines): ALL routes in one file. Auth = single shared passcode via x-passcode header, timing-safe hash compare (server.ts:267-279); cron via x-cron-secret (server.ts:269-271); /health bypasses auth (server.ts:268). CORS allows requests WITHOUT Origin header (callback(null,true) when !origin, server.ts:34-37) — curl/non-browser clients hit every endpoint subject to passcode. express.json limit 64kb (server.ts:70). NO rate limiting observed anywhere yet (verify: grep "rate" backend/src).
- AI credential vault: prisma AiProviderCredential {encryptedApiKey, encryptionIv, authTag} AES-GCM via backend/src/lib/ai/credentials.ts; keys seeded from env on boot (server.ts:153-195); POST /api/ai/config accepts new key, GET /api/ai/config returns keyHint only (server.ts:244-263). GET /api/ai/models proxies provider /models with Bearer key server-side (server.ts:495-539).
- Prompt preamble read/write: GET/POST /api/settings/prompt does fs.readFileSync/writeFileSync on process.cwd()/prompts/_preamble.md (server.ts:572-597) — writes system prompt from API caller; loadPrompt() reads cwd()/prompts at request time (server.ts:114-126): deploy packaging dependency (Render must ship prompts/).
- Legacy POST /api/journal (server.ts:600-722) is DEAD: middleware at server.ts:291-296 returns 410 for exact path /api/journal before it. Its handler stores promptPreview=full prompt incl. journal entry text into Postgres AiCallLog (server.ts:679-688) — currently unreachable but a latent privacy hazard if middleware removed. Active journal feedback route deliberately avoids AiCallLog (comment server.ts:724-725).
- Journal privacy design: private journal persisted ONLY in Cloudflare D1 via cloudflare/journal-store worker (backend/src/lib/private-journal-store.ts, private-tracker-store.ts). Verify encryption claims + how backend authenticates to worker (service token in env?) + what D1 outage handling does.
- DB: single Prisma schema prisma/schema.prisma (root!) while backend/package.json build uses ./prisma/schema.prisma relative to backend/ — VERIFY which schema file backend actually uses vs root one (two copies? drift risk). Models: Settings(id="default"), Finance* (single-row budget id="default"), AiProviderCredential, AiCallLog, InterviewAttempt(sessionId), StudyLog etc. Single-user: NO User model anywhere.
- Mobile: Expo RN app; passcode stored locally (mobile/app/passcode.tsx — check SecureStore vs AsyncStorage); finance module components under mobile/src/components/finance/.
- Frontend: Next.js app router; passcode/page.tsx posts to /api/auth (prior audit cites this; current backend has /api/auth/verify — CHECK contract mismatch); sandbox-chat route exists — check what it exposes.
- Vendored LibreChat wired as chat backend? frontend/app/chat + backend gateway.ts relationship — determine actual data flow (who calls LibreChat? is it deployed?).
- Root package.json duplicates prisma dep (prisma ^5.22.0 at root vs backend ^5.10.2) — version skew lead.
- backend/dev-server.err.log exists on disk (untracked) — hygiene lead; check .gitignore coverage.
- HIPAA/\bPHI\b signal matched backend/src/server.ts — locate the actual mention; likely a comment; confirm no regulated-data processing (PRD says none).

## Deterministic evidence leads (first-party, from EVIDENCE.json)
- backend/.env EXISTS locally with possible-secret signals — NOT git-tracked (git ls-files clean), gitignored (check-ignore passed). Do NOT quote values anywhere.
- .github/workflows/vercel-production-check.yml flagged possible-secret — inspect how secrets are referenced.
- AUDIT_REPORT.md, backend/.env.example flagged database-access strings — likely DATABASE_URL mentions; verify no real credentials.

## Prior audit open questions (verify current status, cite new evidence)
1. Explainer off-scope CS topics (explainer/page.tsx suggestions).
2. Interview skips/timeouts never persisted (InterviewAttempt.skipped unwritten).
3. Interview sessionId/questionIndex always fresh → sessions can't group (gateway.ts ~170).
4. Tracker 7-section AI analysis claimed but missing (server.ts tracker routes).

## Rules for every domain pass
- Evidence over assertion; quotes with path:line; absence needs exact search + scope + zero hits.
- No secret values in any output. Mask if encountered.
- Findings must survive substitution test; cluster by root cause; respect ownership map (secrets/injection→security; indexes/N+1→database; prompt-injection→security cross-ref llm; test existence→repo; visual a11y→ui; flow a11y→ux; dead code/error-handling→code-quality; naming→style-genome; AGENTS.md→agent-memory; log redaction→security not observe).
