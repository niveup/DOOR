from pathlib import Path
import re

for path in Path('frontend').rglob('*'):
    if path.suffix not in {'.ts','.tsx'} or 'node_modules' in path.parts: continue
    text=path.read_text(encoding='utf-8-sig')
    text=re.sub(r'\s*["\']x-passcode["\']\s*:\s*["\']1234["\']\s*,?', '', text)
    path.write_text(text,encoding='utf-8')

path=Path('backend/src/server.ts')
server=path.read_text(encoding='utf-8-sig')
if 'import crypto from "crypto";' not in server:
    server=server.replace('import express, { Request, Response, NextFunction } from "express";', 'import express, { Request, Response, NextFunction } from "express";\nimport crypto from "crypto";')
server=server.replace('const allowedOrigins = ["http://localhost:3000", "https://jujum.vercel.app"];', '''const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || (isProduction ? "" : "http://localhost:3000"))
 .split(",").map((value) => value.trim()).filter(Boolean);
if (isProduction && allowedOrigins.length === 0) throw new Error("ALLOWED_ORIGINS is required in production.");''')
server=server.replace('if (isLocalIp) {', 'if (!isProduction && isLocalIp) {')
server=server.replace('app.use(express.json());', 'app.use(express.json({ limit: "64kb" }));')
start=server.find('function passcodeAuth('); end=server.find('app.use(passcodeAuth);',start)
if start<0 or end<0: raise SystemExit('passcodeAuth markers missing')
new='''function passcodeAuth(req: Request, res: Response, next: NextFunction) {
 if (req.path === "/health") return next();
 const expectedCron = process.env.CRON_SHARED_SECRET;
 const cronHeader = typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "";
 if (req.path.startsWith("/cron") && expectedCron && cronHeader && crypto.timingSafeEqual(crypto.createHash("sha256").update(cronHeader).digest(), crypto.createHash("sha256").update(expectedCron).digest())) return next();
 const expected = process.env.APP_PASSCODE;
 if (!expected || expected.length < 8) return res.status(503).json({ error: "Backend authentication is not configured." });
 const received = typeof req.headers["x-passcode"] === "string" ? req.headers["x-passcode"] : "";
 if (crypto.timingSafeEqual(crypto.createHash("sha256").update(received).digest(), crypto.createHash("sha256").update(expected).digest())) return next();
 return res.status(401).json({ error: "Unauthorized" });
}

'''
server=server[:start]+new+server[end:]
old='''if (!entryText || entryText.trim().length < 20) {
 return res.status(400).json({ error: "Journal entry must be at least 20 characters." });
 }'''
new_validation='''if (typeof entryText !== "string" || entryText.trim().length < 20 || entryText.length > 5000) {
 return res.status(400).json({ error: "Journal entry must be between 20 and 5000 characters." });
 }'''
if old not in server: raise SystemExit('journal validation marker missing')
server=server.replace(old,new_validation,1)
path.write_text(server,encoding='utf-8')
