from pathlib import Path
import re

# Browser requests use the authenticated same-origin relay. Remove every client-supplied public passcode.
for path in Path('frontend').rglob('*'):
    if path.suffix not in {'.ts','.tsx'} or 'node_modules' in path.parts: continue
    text=path.read_text(encoding='utf-8-sig')
    text=re.sub(r'\s*["\']x-passcode["\']\s*:\s*["\']1234["\']\s*,?', '', text)
    path.write_text(text,encoding='utf-8')

server_path=Path('backend/src/server.ts')
server=server_path.read_text(encoding='utf-8-sig')
if 'import crypto from "crypto";' not in server:
    server=server.replace('import express, { Request, Response, NextFunction } from "express";', 'import express, { Request, Response, NextFunction } from "express";\nimport crypto from "crypto";\nimport { logger } from "./lib/logger";')
server=server.replace('const allowedOrigins = ["http://localhost:3000", "https://jujum.vercel.app"];', '''const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || (isProduction ? "" : "http://localhost:3000"))
 .split(",").map((value) => value.trim()).filter(Boolean);
if (isProduction && allowedOrigins.length === 0) throw new Error("ALLOWED_ORIGINS is required in production.");''')
# Replace local-network CORS exception with a development-only gate.
server=server.replace('if (isLocalIp) {', 'if (!isProduction && isLocalIp) {')
server=server.replace('app.use(express.json());', 'app.use(express.json({ limit: "64kb" }));')
start=server.find('function passcodeAuth('); end=server.find('app.use(passcodeAuth);',start)
if start<0 or end<0: raise SystemExit('passcodeAuth markers missing')
new_auth='''function passcodeAuth(req: Request, res: Response, next: NextFunction) {
 if (req.path === "/health") return next();
 const expectedCron = process.env.CRON_SHARED_SECRET;
 const cronHeader = typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "";
 if (req.path.startsWith("/cron") && expectedCron && cronHeader && crypto.timingSafeEqual(crypto.createHash("sha256").update(cronHeader).digest(), crypto.createHash("sha256").update(expectedCron).digest())) return next();
 const expected = process.env.APP_PASSCODE;
 if (!expected || expected.length < 8) return res.status(503).json({ error: "Backend authentication is not configured." });
 const received = typeof req.headers["x-passcode"] === "string" ? req.headers["x-passcode"] : "";
 const valid = crypto.timingSafeEqual(crypto.createHash("sha256").update(received).digest(), crypto.createHash("sha256").update(expected).digest());
 if (valid) return next();
 return res.status(401).json({ error: "Unauthorized" });
}

'''
server=server[:start]+new_auth+server[end:]
needle='if (!entryText || entryText.trim().length < 20) {'
replacement='''if (typeof entryText !== "string" || entryText.trim().length < 20 || entryText.length > 5000) {
 return res.status(400).json({ error: "Journal entry must be between 20 and 5000 characters." });
}

if (JSON.stringify(req.body).length > 60000) {
 return res.status(413).json({ error: "Journal request is too large." });
}

if (false) {'''
if needle not in server: raise SystemExit('journal validation marker missing')
server=server.replace(needle,replacement,1)
# Convert legacy console calls to structured logger calls.
server=server.replace('console.log(', 'logger.info(').replace('console.error(', 'logger.error(').replace('console.warn(', 'logger.warn(')
server_path.write_text(server,encoding='utf-8')

# Structured logging in remaining production TS sources.
for rel in ['backend/src/gateway.ts','backend/src/lib/ai/provider.ts','backend/src/seed.ts','backend/src/debug_logs.ts']:
    p=Path(rel)
    if not p.exists(): continue
    text=p.read_text(encoding='utf-8-sig')
    if not re.search(r'console\.(?:log|error|warn)\(',text): continue
    if 'lib/ai/' in rel: imp='import { logger } from "../logger";\n'
    elif rel.endswith('gateway.ts') or rel.endswith('seed.ts') or rel.endswith('debug_logs.ts'): imp='import { logger } from "./lib/logger";\n'
    else: imp=''
    if imp and 'logger }' not in text: text=imp+text
    text=text.replace('console.log(', 'logger.info(').replace('console.error(', 'logger.error(').replace('console.warn(', 'logger.warn(')
    p.write_text(text,encoding='utf-8')
