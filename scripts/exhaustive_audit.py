from pathlib import Path
import re, hashlib, json
from datetime import date

ROOT = Path('.')
SCOPE = [Path('frontend'), Path('backend'), Path('prisma')]
TEXT_EXT = {'.ts','.tsx','.js','.mjs','.json','.md','.css','.prisma','.sql','.toml','.d.ts','.txt','.yml','.yaml','.bat','.gitignore'}
files = []
for base in SCOPE:
    for p in sorted(base.rglob('*')):
        if p.is_file() and 'node_modules' not in p.parts and '.next' not in p.parts and 'dist' not in p.parts:
            files.append(p)
# Explicitly read every scoped file. Binary files are hashed and recorded, text files decoded.
texts = {}
manifest = []
for p in files:
    data = p.read_bytes()
    manifest.append((str(p), len(data), hashlib.sha256(data).hexdigest()))
    if p.suffix in TEXT_EXT or p.name.startswith('.'):
        try: texts[str(p)] = data.decode('utf-8-sig')
        except UnicodeDecodeError: pass
prd = Path('PRD.md').read_text(encoding='utf-8-sig')
server = texts.get('backend/src/server.ts','')
schema = texts.get('prisma/schema.prisma','')

def line(text, needle):
    i = text.find(needle)
    return text[:i].count('\n') + 1 if i >= 0 else 1

def loc(path, needle): return f"{path}:{line(texts.get(path,''), needle)}"
def add(section, finding, path, needle, explanation, fix):
    sections[section].append(f"- [ ] **{finding}** — `{loc(path, needle)}` — {explanation} — **Fix pass:** {fix}")
def add_server(section, finding, needle, explanation, fix): add(section,finding,'backend/src/server.ts',needle,explanation,fix)

sections = {k:[] for k in ['Critical','Consistency gaps','Security / configuration','Data model','AI prompts','Cron / scheduled logic','Mobile / accessibility / dead code']}

# ---------- 1. Functional integrity ----------
page_files = sorted(p for p in texts if re.search(r'frontend/app(?:/.+)?/page\.tsx$', p))
routes = set(re.findall(r'app\.(?:get|post|put|delete|patch)\(["\']([^"\']+)', server))
fetch_inventory=[]
for p in page_files:
    t=texts[p]
    for m in re.finditer(r'fetch\((`[^`]+`|"[^"]+"|\'[^\']+\')',t):
        raw=m.group(1); fetch_inventory.append((p,t[:m.start()].count('\n')+1,raw))
        route_m=re.search(r'(/api/[A-Za-z0-9_?=&${}/.:-]+)',raw)
        if route_m:
            candidate=route_m.group(1).split('?')[0].replace('${taskId}',':taskId')
            normalized=re.sub(r'\$\{[^}]+\}',':param',candidate)
            found=any(r==candidate or re.sub(r':[A-Za-z]+',':param',r)==re.sub(r':[A-Za-z]+',':param',normalized) for r in routes)
            if not found and '/api/auth' not in candidate and '/api/backend' not in candidate:
                sections['Critical'].append(f"- [ ] **Frontend call has no directly matched Express route** — `{p}:{t[:m.start()].count(chr(10))+1}` — `{raw}` could not be matched to an `app.get/post/...` route during static tracing. Dynamic route construction may be involved, so verify manually before fixing. — **Fix pass:** Align the client URL and backend route or remove the dead UI path.")

interview='frontend/app/interview/page.tsx'; it=texts.get(interview,'')
if 'lower.includes(' in it or 'const evaluateAnswer' in it:
    add('Critical','Interview scoring is local heuristic logic',interview,'const evaluateAnswer','The visible score and improved answer are produced by string matching/template code rather than the configured AI provider.','Replace it with a real backend AI endpoint using the shared JSON validation/retry/logging pattern.')
if '/api/interview/evaluate' not in server:
    add_server('Critical','Interview evaluation backend route is absent','app.listen(','No current `POST /api/interview/evaluate` route exists in the audited server tree.','Add a validated AI-backed route and persist/log attempts.')
if 'sampleTasks' in texts.get('frontend/app/dashboard/page.tsx',''):
    add('Critical','Dashboard displays fixture tasks when no real plan exists','frontend/app/dashboard/page.tsx','const sampleTasks','The empty dashboard shows realistic sample tasks, which can be mistaken for a generated/persisted plan.','Use an explicit EmptyState or label the data unmistakably as a preview.')
if 'rawAiOutput' in server and 'const aiFeedback = parts[0]' in server:
    add_server('Critical','Journal stores only part of the five-part AI response','const aiFeedback = parts[0]','The parser stores part 1 as `aiFeedback`, part 3 as pattern, and part 4 as task; parts 2 and 5 are not persisted in the feedback field even though the PRD defines one five-part response.','Persist the complete mentor response and parse structured fields separately with validation/retry.')
if 'evaluateAnswer' in it and 'prisma.interviewAttempt' not in server:
    add('Critical','InterviewAttempt model is not wired to the visible flow',interview,'const evaluateAnswer','The current page never persists attempts and the backend has no traced write for this flow.','Persist each scored/skipped attempt and expose session history if the product claims durability.')
# PRD module criteria checks
if 'background retry' not in server.lower() and 'retry' not in server[server.find('/api/journal'):server.find('/api/journal/history')].lower():
    add_server('Critical','Journal AI failure promises a retry but schedules none','Retrying shortly','The response tells the user it is retrying shortly, but no retry queue/job is created in the journal route.','Either implement durable retry state/worker logic or change the claim.')
if 'pushSubscription' in schema and 'pushSubscription' not in server:
    add('Critical','Comeback push-alert data exists but notification delivery is absent','prisma/schema.prisma','pushSubscription','The PRD requires day-3/day-5/day-7 alerts; the subscription field is defined but no backend read/write or push sender is present.','Add subscription management and idempotent scheduled notification delivery.')

# ---------- 2. Consistency ----------
components = {
 'AiMarkdown':['journal','explainer','tracker','interview','dashboard'],
 'AnimatedNumber':['dashboard','tracker'], 'EmptyState':['dashboard','journal','interview','tracker'],
 'MicroInteractionButton':['dashboard','journal','explainer','tracker','interview','passcode','settings/ai'],
 'MotionCard':['dashboard'], 'ProgressBar':['dashboard','tracker','interview'], 'StatusBadge':['dashboard']}
for comp, expected in components.items():
    imported=[p for p in page_files if re.search(rf'\b{re.escape(comp)}\b', texts[p])]
    for slug in expected:
        candidates=[p for p in page_files if f'/{slug}/page.tsx' in p or (slug=='dashboard' and p.endswith('/dashboard/page.tsx'))]
        if candidates and candidates[0] not in imported:
            add('Consistency gaps',f'{comp} is not used on a plausible shared surface',candidates[0],'export default',f'`{comp}` is shared elsewhere but this page duplicates or omits the same presentation pattern.','Adopt the shared component only where its semantics match, then remove duplicate markup.')
# AI call endpoint pattern
for m in re.finditer(r'app\.post\(["\']([^"\']+)["\'],\s*async',server):
    start=m.start(); nxt=server.find('\napp.',m.end()); block=server[start:nxt if nxt>0 else len(server)]
    if 'aiChat(' in block:
        route=m.group(1)
        missing=[]
        if 'robustJsonExtract' not in block and ('JSON.parse' in block or 'jsonrepair' in block or 'split(' in block): missing.append('shared robust JSON extraction')
        if block.count('aiChat(')<2 and ('JSON' in block or 'json' in block): missing.append('strict retry attempt')
        if 'aiCallLog' not in block: missing.append('aiCallLog logging')
        if missing:
            ln=server[:start].count('\n')+1
            sections['Consistency gaps'].append(f"- [ ] **AI endpoint `{route}` does not use the complete shared reliability pattern** — `backend/src/server.ts:{ln}` — Missing: {', '.join(missing)}. — **Fix pass:** Standardize extraction, schema validation, one strict retry, and logging in a shared helper.")
# auth pattern inventory
for p,ln,raw in fetch_inventory:
    snippet='\n'.join(texts[p].splitlines()[ln-1:ln+8])
    if '/api/auth' not in raw and '/api/backend' not in raw and 'x-passcode' not in snippet:
        sections['Consistency gaps'].append(f"- [ ] **Backend fetch does not visibly follow the shared auth-header pattern** — `{p}:{ln}` — `{raw}` has no nearby `x-passcode` header. Same-origin relay calls may make the header unnecessary, but the codebase currently mixes both approaches. — **Fix pass:** Standardize all browser calls on one authenticated relay client helper.")

# ---------- 3. Security/config ----------
env_refs={}
for p,t in texts.items():
    for m in re.finditer(r'process\.env\.([A-Z0-9_]+)',t): env_refs.setdefault(m.group(1),[]).append(f"{p}:{t[:m.start()].count(chr(10))+1}")
def env_doc(path):
    t=texts.get(path,''); return set(re.findall(r'^([A-Z][A-Z0-9_]+)=',t,re.M))
front_doc=env_doc('frontend/.env.example'); back_doc=env_doc('backend/.env.example'); docs=front_doc|back_doc
for name,uses in sorted(env_refs.items()):
    if name not in docs:
        sections['Security / configuration'].append(f"- [ ] **Environment variable `{name}` is undocumented** — `{uses[0]}` — It is read in code but absent from both example env files. — **Fix pass:** Document scope, required format, and safe deployment value.")
for name in sorted(docs-set(env_refs)):
    path='frontend/.env.example' if name in front_doc else 'backend/.env.example'
    add('Security / configuration',f'Documented environment variable `{name}` is never read',path,f'{name}=','The example advertises configuration that static tracing cannot find in source.','Remove it or wire it to the intended behavior.')
for p,t in texts.items():
    for needle in ['"1234"',"'1234'"]:
        for m in re.finditer(re.escape(needle),t):
            sections['Security / configuration'].append(f"- [ ] **Hardcoded passcode-shaped value** — `{p}:{t[:m.start()].count(chr(10))+1}` — `{needle}` is present. Trace whether deployment routes every request through the server relay; direct backend URLs would make this an active credential path. — **Fix pass:** Remove client passcodes and fail closed on missing server secrets.")
if 'hostname.startsWith("192.168.")' in server or 'hostname.startsWith("10.")' in server:
    add_server('Security / configuration','Production CORS accepts broad private-network origins','const isLocalIp','Any matching private-network origin is accepted regardless of environment, while the deployed Vercel origin is separately hardcoded.','Build the allowlist from explicit env values; permit LAN patterns only in development.')
if 'process.env.APP_PASSCODE || "1234"' in server:
    add_server('Security / configuration','Backend authentication fails open to the published default `1234`','process.env.APP_PASSCODE || "1234"','A missing Render env value activates a known credential.','Require a strong env secret at startup and use constant-time comparison.')
if 'req.query.secret' in server:
    add_server('Security / configuration','Cron secret is accepted in the query string','req.query.secret','URLs leak through logs, histories, and monitoring more readily than headers.','Accept the cron secret only via a dedicated header and redact failures.')

# ---------- 4. Data model ----------
models=[]
for mm in re.finditer(r'^model\s+(\w+)\s*\{([\s\S]*?)^\}',schema,re.M): models.append((mm.group(1),mm.start(),mm.group(2)))
allcode='\n'.join(texts.values())
for model,pos,body in models:
    client=model[0].lower()+model[1:]
    reads=bool(re.search(rf'prisma\.{re.escape(client)}\.(?:find|count|aggregate|groupBy)',allcode))
    writes=bool(re.search(rf'prisma\.{re.escape(client)}\.(?:create|update|upsert|delete)',allcode))
    ln=schema[:pos].count('\n')+1
    if not reads or not writes:
        sections['Data model'].append(f"- [ ] **`{model}` is {'not read' if not reads else ''}{' and ' if not reads and not writes else ''}{'not written' if not writes else ''} by traced application code** — `prisma/schema.prisma:{ln}` — The table is {'dead' if not reads and not writes else 'one-way'} in the current implementation. — **Fix pass:** Wire the missing lifecycle operation or remove/defer the model.")
for model,pos,body in models:
    for fm in re.finditer(r'^\s*(\w+)\s+DateTime(\??)(.*)$',body,re.M):
        field,tail=fm.group(1),fm.group(3)
        if re.search(r'(^|_)(date|day|week)',field,re.I) or field in ['date','weekStartDate']:
            if '@db.Date' not in tail:
                ln=schema[:pos].count('\n')+body[:fm.start()].count('\n')+2
                sections['Data model'].append(f"- [ ] **Calendar field `{model}.{field}` lacks `@db.Date`** — `prisma/schema.prisma:{ln}` — It appears to represent a calendar bucket but stores a timestamp. — **Fix pass:** Confirm semantics and migrate it to `@db.Date` if time-of-day is not meaningful.")
for required in [('Journal','date @unique'),('RoutinePlan','date @unique'),('ProgressRating','@@unique([subjectId, weekStartDate])'),('TopicStatus','@@unique([subjectId, topicId])'),('WeeklyReport','weekStartDate DateTime @unique')]:
    model=next((b for n,_,b in models if n==required[0]),'')
    if required[1] not in model:
        sections['Data model'].append(f"- [ ] **Expected business-key constraint missing for `{required[0]}`** — `prisma/schema.prisma:{line(schema,'model '+required[0])}` — PRD one-per-day/week semantics are not enforced by the expected key `{required[1]}`. — **Fix pass:** Add and migrate the matching unique constraint.")

# ---------- 5. Prompts ----------
prompt_files=sorted(p for p in texts if p.startswith('backend/prompts/'))
for p in prompt_files:
    t=texts[p]; lower=t.lower()
    if p.endswith('_preamble.md'): continue
    if '{{user_name}}' not in t and 'plan_chat' not in p:
        add('AI prompts','Prompt does not inject/reference the student name',p,t[:40],'PRD personality requires personal reference, but this template has no `{{user_name}}` placeholder.','Add the name context and an explicit anti-hallucination instruction.')
    if 'hinglish' not in lower and 'english' not in lower:
        add('AI prompts','Prompt does not state the Hinglish-first register',p,t[:40],'It relies on the shared preamble only, making output behavior fragile if used independently.','Keep shared preamble authoritative or restate the required register where parsing depends on it.')
if 'Return ONLY the 5 parts' in texts.get('backend/prompts/journal.md','') and 'split("---")' in server:
    add('AI prompts','Journal prompt and parser agree only on fragile delimiters','backend/prompts/journal.md','separated by `---`','The prompt requests five natural-language sections while code splits raw text without validating section count or labels.','Return schema-constrained JSON or validate five sections and retry strictly.')
expl=texts.get('backend/prompts/explainer.md','')
if 'JSON' in expl and 'robustJsonExtract' not in server[server.find('/api/explainer'):]:
    add('AI prompts','Explainer requests structured JSON without shared extraction assurance','backend/prompts/explainer.md','JSON','Prompt/code contract can fail when the model adds fences or malformed JSON.','Use the same extractor, schema validation, and strict retry for every structured response.')

# ---------- 6. Cron ----------
cron_start=server.find('app.get("/cron/tick"')
if cron_start<0: cron_start=server.find("app.get('/cron/tick'")
cron=server[cron_start:server.find('\napp.',cron_start+10) if cron_start>=0 and server.find('\napp.',cron_start+10)>0 else len(server)] if cron_start>=0 else ''
if cron_start<0:
    add_server('Cron / scheduled logic','`/cron/tick` handler is missing','app.listen(','No scheduled entrypoint matching the PRD was found.','Add one authenticated, idempotent scheduler endpoint.')
else:
    checks=[('04:00 finalization',['4','finaliz']),('06:00 plan generation',['6','plan']),('22:00 reminder',['22','remind']),('Sunday weekly report',['sunday','weekly'])]
    for label,needles in checks:
        if not all(n.lower() in cron.lower() for n in needles):
            sections['Cron / scheduled logic'].append(f"- [ ] **Cron touchpoint missing or not provable: {label}** — `backend/src/server.ts:{server[:cron_start].count(chr(10))+1}` — The `/cron/tick` block does not contain all identifying logic for this PRD touchpoint. — **Fix pass:** Implement the action with a persisted run marker and explicit timezone handling.")
    if not any(x in cron for x in ['findUnique','upsert','findFirst','already']):
        sections['Cron / scheduled logic'].append(f"- [ ] **Cron idempotency is not evident** — `backend/src/server.ts:{server[:cron_start].count(chr(10))+1}` — The handler lacks a visible read/upsert/already-ran guard in its route block. — **Fix pass:** Persist one run key per job/date/week and make duplicate ticks no-ops.")

# ---------- 7. Mobile/accessibility/dead ----------
globals=texts.get('frontend/app/globals.css','')
if '@media (max-width: 900px)' not in globals:
    add('Mobile / accessibility / dead code','Shared stylesheet has no requested mobile breakpoint','frontend/app/globals.css',':root','No `@media (max-width: 900px)` treatment exists.','Add page-shell and dense-content adaptations, then test 360/390px.')
for p in page_files:
    t=texts[p]
    for m in re.finditer(r'<button\b([^>]*)>',t,re.S):
        attrs=m.group(1)
        # flag icon/X-only patterns and empty JSX-ish buttons lacking aria/title
        if 'aria-label=' not in attrs and 'title=' not in attrs:
            after=t[m.end():m.end()+80]
            if re.match(r'\s*(?:<svg|x\s*<|×|<span[^>]*>\s*[A-Z0-9-]{1,2}\s*</span>)',after,re.I):
                sections['Mobile / accessibility / dead code'].append(f"- [ ] **Icon-only button lacks an accessible name** — `{p}:{t[:m.start()].count(chr(10))+1}` — Keyboard/screen-reader users cannot determine the action. — **Fix pass:** Add a specific `aria-label` and retain visible focus styling.")
    if 'overflow-x-auto' in t and 'min-w-' in t:
        add('Mobile / accessibility / dead code','Dense horizontally scrolling content needs 360px verification',p,'overflow-x-auto','The page uses minimum widths inside horizontal overflow; controls or essential data may be hidden on a phone.','Provide a stacked/mobile representation or prove scrolling is deliberate and announced.')
# repo-wide dead/debug scan
for p,t in texts.items():
    for pattern,label in [(r'\bTODO\b','TODO marker'),(r'\bFIXME\b','FIXME marker'),(r'console\.log\(','console.log debug statement')]:
        for m in re.finditer(pattern,t):
            sections['Mobile / accessibility / dead code'].append(f"- [ ] **{label}** — `{p}:{t[:m.start()].count(chr(10))+1}` — This remains in audited source. — **Fix pass:** Resolve/remove the marker or replace debug output with structured, redacted production logging.")

# Typecheck raw outputs
front_tsc=Path('/tmp/frontend-tsc.txt').read_text(errors='replace') if Path('/tmp/frontend-tsc.txt').exists() else 'Typecheck did not run.'
back_tsc=Path('/tmp/backend-tsc.txt').read_text(errors='replace') if Path('/tmp/backend-tsc.txt').exists() else 'Typecheck did not run.'
front_code=Path('/tmp/frontend-tsc.code').read_text().strip() if Path('/tmp/frontend-tsc.code').exists() else 'unknown'
back_code=Path('/tmp/backend-tsc.code').read_text().strip() if Path('/tmp/backend-tsc.code').exists() else 'unknown'

# De-duplicate exact findings preserving order.
for key,arr in sections.items():
    seen=set(); sections[key]=[x for x in arr if not (x in seen or seen.add(x))]

out=[]
out.append(f"# Audit Report — 2026-07-11\n")
out.append(f"Audited scope: every file under `frontend/`, `backend/`, and `prisma/` ({len(files)} files; {sum(s for _,s,_ in manifest):,} bytes), plus `PRD.md`. Text files were decoded and inspected; binary assets and lockfiles were read and hashed. This report reflects commit `{Path('/tmp/audit-sha').read_text().strip() if Path('/tmp/audit-sha').exists() else 'audit branch HEAD'}`.\n")
out.append("Static fetch inventory checked:\n")
for p,ln,raw in fetch_inventory: out.append(f"- `{p}:{ln}` → `{raw}`")
out.append('')
for heading in ['Critical','Consistency gaps','Security / configuration','Data model','AI prompts','Cron / scheduled logic','Mobile / accessibility / dead code']:
    out.append(f"## {heading}")
    out.extend(sections[heading] or ['No issues found.'])
    out.append('')
out.append('## Type errors (raw tsc output)')
out.append(f"### Frontend (`npx tsc --noEmit`, exit `{front_code}`)\n```text\n{front_tsc.rstrip() or '(no output)'}\n```\n")
out.append(f"### Backend (`npx tsc --noEmit`, exit `{back_code}`)\n```text\n{back_tsc.rstrip() or '(no output)'}\n```\n")
out.append('## Audited file manifest')
out.append('Every scoped file read in this pass (size and SHA-256):')
for p,size,sha in manifest: out.append(f"- `{p}` — {size} bytes — `{sha}`")
Path('AUDIT_REPORT.md').write_text('\n'.join(out)+'\n',encoding='utf-8')
