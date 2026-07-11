from pathlib import Path
import re

report_path=Path('AUDIT_REPORT.md')
report=report_path.read_text(encoding='utf-8')
texts={}
for root in ['frontend','backend','prisma']:
    for p in Path(root).rglob('*'):
        if p.is_file() and 'node_modules' not in p.parts and '.next' not in p.parts and 'dist' not in p.parts:
            try: texts[str(p)]=p.read_text(encoding='utf-8-sig')
            except UnicodeDecodeError: pass

def ln(path,needle):
    t=texts.get(path,''); i=t.find(needle); return t[:i].count('\n')+1 if i>=0 else 1

def item(title,path,needle,why,fix):
    return f'- [ ] **{title}** — `{path}:{ln(path,needle)}` — {why} — **Fix pass:** {fix}'

def insert(section, value):
    global report
    marker=f'## {section}\n'
    at=report.index(marker)+len(marker)
    report=report[:at]+value+'\n'+report[at:]

# Remove static-analysis false positives after tracing gateway.ts and Prisma's env()/relations.
remove_contains=[
 'Frontend call has no directly matched Express route',
 'Interview evaluation backend route is absent',
 'AI endpoint `/api/tasks/:taskId/status`',
 'Documented environment variable `DATABASE_URL` is never read',
 'Documented environment variable `DIRECT_URL` is never read',
 '`Task` is not read by traced application code',
 'Expected business-key constraint missing for `Journal`',
 'Expected business-key constraint missing for `RoutinePlan`',
 'Expected business-key constraint missing for `WeeklyReport`',
 'Prompt does not state the Hinglish-first register',
]
report='\n'.join(line for line in report.splitlines() if not any(x in line for x in remove_contains))+'\n'

server=texts['backend/src/server.ts']; gateway=texts.get('backend/src/gateway.ts','')
journal_block=server[server.find('app.post("/api/journal"'):server.find('app.get("/api/journal/history"')]
tracker_start=server.find('/api/tracker/status'); tracker_end=server.find('/cron/tick')
tracker_block=server[tracker_start:tracker_end if tracker_end>tracker_start else len(server)]

# Functional/PRD gaps missed by the first mechanical pass.
if '> 5000' not in journal_block and 'length > 5000' not in journal_block:
    insert('Critical',item('Journal backend does not enforce the PRD 5000-character maximum','backend/src/server.ts','Journal entry must be at least 20 characters','The browser caps input, but direct API callers can submit unbounded journal text into storage and AI context.','Add server-side max-length validation and a request-size bound.'))
if 'aiChat(' not in tracker_block:
    insert('Critical',item('Progress Tracker never produces the PRD seven-section AI analysis','backend/src/server.ts','/api/tracker/status','Tracker routes calculate/read ratings but do not call the AI for weak/strong/neglected subjects, recommended topics, weekly plan, readiness, and avoidance warnings as one analysis.','Add a logged, retrying analysis endpoint or remove the AI-analysis claim from the product.'))
if 'interview-${Date.now()}' in gateway:
    insert('Critical',item('Interview answers cannot form a real five-question session','backend/src/gateway.ts','sessionId: `interview-${Date.now()}`','Every evaluation receives a fresh sessionId and questionIndex 0, so the persisted rows cannot be grouped or ordered into the PRD session summary.','Send a stable sessionId/questionIndex from the client, validate them, and compute a session total.'))
if 'setAnsweredCount' in texts.get('frontend/app/interview/page.tsx','') and '/api/interview/skip' not in gateway:
    insert('Critical',item('Interview skips/timeouts are presented as session progress but are never persisted','frontend/app/interview/page.tsx','const handleSkip','The counter advances locally while InterviewAttempt has a `skipped` field that the visible flow never writes.','Persist skips with the active session and question index, including Rapid Fire timeout advances.'))
expl=texts.get('frontend/app/explainer/page.tsx','')
if 'Heap Memory' in expl or 'Stack and Queue' in expl:
    insert('Critical',item('Concept Explainer promotes off-scope computer-science topics','frontend/app/explainer/page.tsx','What is Heap Memory?','The PRD defines a GATE Mechanical explainer, but first-run suggestions advertise heap memory, stack/queue, and binary search; this contradicts the stated scope and weak-subject loop.','Replace suggestions and validation with the seeded GATE ME subject/topic catalog or explicitly broaden the product scope.'))

# Gateway-specific cross-checks.
if 'app.post("/api/interview/evaluate"' in gateway:
    insert('Consistency gaps',item('Interview AI reliability is implemented in gateway.ts rather than the shared server AI layer','backend/src/gateway.ts','app.post("/api/interview/evaluate"','The endpoint correctly extracts, retries, logs, and persists, but duplicates credential resolution/validation logic outside server.ts; future endpoints can drift.','Extract one shared AI structured-output service and import it from both gateway and core routes.'))
if 'score: Math.round(feedback.score)' in gateway:
    insert('Data model',item('Half-point interview totals are rounded before persistence','backend/src/gateway.ts','score: Math.round(feedback.score)','The API can return 0.5 increments, but InterviewAttempt.score is Int and stores a rounded value, so durable history disagrees with what the user saw.','Use a Float/Decimal score or constrain all displayed totals to integers.'))
# Schema env() is a real runtime read; add an explicit no-issue statement for constraints/date review.
insert('Data model','- [ ] **No calendar-date or required business-key constraint issue found** — `prisma/schema.prisma:42` — Journal.date, RoutinePlan.date, ProgressRating.weekStartDate, and WeeklyReport.weekStartDate use `@db.Date`; the one-per-day/week keys are enforced with `@unique`/`@@unique`. — **Fix pass:** No fix; retain these constraints during future migrations.')

# Security nuance: external gateway allowlist is strict, internal core remains broad/fail-open.
if 'ALLOWED_ORIGINS' in gateway:
    insert('Security / configuration',item('Gateway CORS has a hardcoded production fallback origin','backend/src/gateway.ts','process.env.ALLOWED_ORIGINS ||','The external gateway uses an explicit allowlist, but silently falls back to `https://jujum.vercel.app`; renamed preview/production domains will fail until configured.','Document and require ALLOWED_ORIGINS in production, with localhost defaults only in development.'))

# Current CSS/app shell status after merge ordering.
css=texts.get('frontend/app/globals.css','')
if '@media (max-width: 900px)' not in css:
    insert('Mobile / accessibility / dead code',item('Merged global stylesheet contains no page-level phone layout','frontend/app/globals.css','[data-sonner-toast]','The current file ends after generic component/toast rules; there is no 360–390px navigation/content adaptation despite daily Android use.','Add and verify a fixed five-tab bottom bar, safe-area padding, and stacked dense layouts.'))

# Update the scope commit and clarify successful typechecks.
report=report.replace('This report reflects commit `audit branch HEAD`.', 'This report audits source commit `2f10561cadcc932120afe07bec8231c2ad752844`.')
# Ensure endpoint inventory is explicitly cross-referenced to gateway.
needle='- `frontend/app/interview/page.tsx:88` → ``${backendUrl}/api/interview/evaluate```'
if needle in report:
    report=report.replace(needle,needle+' (implemented by `backend/src/gateway.ts:94`)')

report_path.write_text(report,encoding='utf-8')
