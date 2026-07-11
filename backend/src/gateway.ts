import crypto from "node:crypto";
import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { jsonrepair } from "jsonrepair";
import { createAiProvider, AiProviderName } from "./lib/ai/provider";
import { decryptApiKey } from "./lib/ai/credentials";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const externalPort = Number(process.env.PORT || 4000);
const internalPort = Number(process.env.INTERNAL_API_PORT || externalPort + 1);
const configuredOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean) || [];
if (isProduction && configuredOrigins.length === 0) {
 throw new Error("ALLOWED_ORIGINS is required in production.");
}
const allowedOrigins = configuredOrigins.length ? configuredOrigins : ["http://localhost:3000"];
const prisma = new PrismaClient();
const app = express();

app.use(cors({
 origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Not allowed by CORS"));
 },
 methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
 allowedHeaders: ["Content-Type", "x-passcode", "x-cron-secret"],
}));
app.use(express.raw({ type: () => true, limit: "8mb" }));

type InterviewFeedback = {
 score: number;
 dimensions: Array<{ label: string; value: number }>;
 missing: string[];
 improved: string;
};

function safeEqual(received: string, expected: string) {
 const left = crypto.createHash("sha256").update(received).digest();
 const right = crypto.createHash("sha256").update(expected).digest();
 return crypto.timingSafeEqual(left, right);
}

function requirePasscode(req: Request, res: Response) {
 const expected = process.env.APP_PASSCODE;
 if (!expected || expected.length < 8) {
  res.status(503).json({ error: "Backend authentication is not configured." });
  return false;
 }
 const received = typeof req.headers["x-passcode"] === "string" ? req.headers["x-passcode"] : "";
 if (!safeEqual(received, expected)) {
  res.status(401).json({ error: "Unauthorized" });
  return false;
 }
 return true;
}

function jsonBody(req: Request) {
 if (!Buffer.isBuffer(req.body)) return req.body || {};
 if (req.body.length === 0) return {};
 return JSON.parse(req.body.toString("utf8"));
}

function robustJsonExtract(raw: string): unknown {
 const withoutFences = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
 const firstBrace = withoutFences.indexOf("{");
 const lastBrace = withoutFences.lastIndexOf("}");
 const candidate = firstBrace >= 0 && lastBrace > firstBrace ? withoutFences.slice(firstBrace, lastBrace + 1) : withoutFences;
 return JSON.parse(jsonrepair(candidate));
}

async function resolveAi() {
 const credential = await prisma.aiProviderCredential.findFirst({ where: { isActive: true } });
 if (!credential || !["openrouter", "nvidia", "cerebras"].includes(credential.provider)) {
  throw new Error("AI is not configured. Choose an active provider in AI Control.");
 }
 return createAiProvider({
  provider: credential.provider as AiProviderName,
  apiKey: decryptApiKey(credential),
  model: credential.model,
 });
}

function validateFeedback(value: unknown, labels: string[]): InterviewFeedback {
 if (!value || typeof value !== "object") throw new Error("AI response is not an object.");
 const candidate = value as Partial<InterviewFeedback>;
 if (!Array.isArray(candidate.dimensions) || candidate.dimensions.length !== 5) throw new Error("AI must return five dimensions.");
 const dimensions = candidate.dimensions.map((item, index) => {
  const numeric = Number(item?.value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 2) throw new Error("Invalid dimension score.");
  return { label: labels[index], value: Math.round(numeric * 2) / 2 };
 });
 const missing = Array.isArray(candidate.missing)
  ? candidate.missing.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 3)
  : [];
 if (missing.length < 1 || typeof candidate.improved !== "string" || candidate.improved.trim().length < 10) throw new Error("AI feedback is incomplete.");
 return {
  score: Math.round(dimensions.reduce((total, item) => total + item.value, 0) * 2) / 2,
  dimensions,
  missing,
  improved: candidate.improved.trim(),
 };
}

function interviewIdentity(body: Record<string, unknown>) {
 const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
 const questionIndex = Number(body.questionIndex);
 const sessionLength = Number(body.sessionLength);
 if (!/^[a-zA-Z0-9_-]{8,100}$/.test(sessionId)) throw new Error("Invalid interview session.");
 if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex > 49) throw new Error("Invalid question index.");
 if (!Number.isInteger(sessionLength) || sessionLength < 1 || sessionLength > 10 || questionIndex >= sessionLength) throw new Error("Invalid session length.");
 return { sessionId, questionIndex, sessionLength };
}

async function sessionSummary(sessionId: string, sessionLength: number) {
 const attempts = await prisma.interviewAttempt.findMany({ where: { sessionId }, orderBy: { questionIndex: "asc" } });
 if (attempts.length < sessionLength) return null;
 const scored = attempts.filter((attempt) => !attempt.skipped);
 return {
  completed: true,
  answered: scored.length,
  skipped: attempts.length - scored.length,
  totalQuestions: sessionLength,
  averageScore: scored.length ? Math.round((scored.reduce((sum, attempt) => sum + attempt.score, 0) / scored.length) * 10) / 10 : 0,
 };
}

app.post("/api/interview/evaluate", async (req, res) => {
 if (!requirePasscode(req, res)) return;
 let body: Record<string, unknown>;
 try { body = jsonBody(req); } catch { return res.status(400).json({ error: "Invalid JSON request." }); }

 let identity: ReturnType<typeof interviewIdentity>;
 try { identity = interviewIdentity(body); } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid session." }); }
 const company = typeof body.company === "string" ? body.company.trim() : "";
 const mode = typeof body.mode === "string" ? body.mode.trim() : "";
 const question = typeof body.question === "string" ? body.question.trim() : "";
 const answer = typeof body.answer === "string" ? body.answer.trim() : "";
 const allowedModes = new Set(["Technical", "HR", "Mixed", "GD", "Rapid Fire"]);
 if (!company || company.length > 80 || !allowedModes.has(mode)) return res.status(400).json({ error: "Choose a valid company and mode." });
 if (question.length < 5 || question.length > 1200 || answer.length < 20 || answer.length > 8000) return res.status(400).json({ error: "Question or answer length is invalid." });

 const rubrics: Record<string, string[]> = {
  Technical: ["Correctness", "Structure", "Clarity", "Completeness", "Confidence"],
  HR: ["Relevance", "Honesty", "Confidence", "STAR structure", "Professional tone"],
  GD: ["Argument quality", "Balance", "Evidence", "Clarity", "Group awareness"],
  Mixed: ["Correctness", "Relevance", "Structure", "Clarity", "Professional judgment"],
  "Rapid Fire": ["Correctness", "Directness", "Clarity", "Completeness", "Confidence"],
 };
 const labels = rubrics[mode];
 const systemPrompt = [
  "You are a strict GATE and PSU interview evaluator.",
  `Evaluate this ${mode} answer for ${company}.`,
  `Use exactly these dimensions, in order, each scored 0 to 2: ${labels.join(", ")}.`,
  "Return 1 to 3 precise missing points.",
  "Improve the answer at roughly the same length and register. Never invent personal experience.",
  'Return ONLY minified JSON: {"score":number,"dimensions":[{"label":string,"value":number}],"missing":[string],"improved":string}',
 ].join("\n");
 const userPrompt = `QUESTION:\n${question}\n\nANSWER:\n${answer}`;
 const startedAt = Date.now();
 let raw = "";

 try {
  const provider = await resolveAi();
  raw = await provider.chat(systemPrompt, userPrompt);
  let feedback: InterviewFeedback;
  try { feedback = validateFeedback(robustJsonExtract(raw), labels); }
  catch {
   raw = await provider.chat(`${systemPrompt}\nYour previous response failed validation. Return one valid minified JSON object only.`, userPrompt);
   feedback = validateFeedback(robustJsonExtract(raw), labels);
  }
  await prisma.aiCallLog.create({ data: { surface: "interview", latencyMs: Date.now() - startedAt, success: true, promptPreview: userPrompt.slice(0, 1200), responsePreview: raw.slice(0, 1200) } });
  const attempt = await prisma.interviewAttempt.upsert({
   where: { sessionId_questionIndex: { sessionId: identity.sessionId, questionIndex: identity.questionIndex } },
   update: { company, mode, questionText: question, userAnswer: answer, skipped: false, score: feedback.score, dimensions: feedback.dimensions, missingPoints: feedback.missing, improvedAnswer: feedback.improved },
   create: { sessionId: identity.sessionId, company, mode, questionIndex: identity.questionIndex, questionText: question, userAnswer: answer, skipped: false, score: feedback.score, dimensions: feedback.dimensions, missingPoints: feedback.missing, improvedAnswer: feedback.improved },
  });
  return res.json({ ...feedback, attemptId: attempt.attemptId, sessionSummary: await sessionSummary(identity.sessionId, identity.sessionLength) });
 } catch (error) {
  const message = error instanceof Error ? error.message : "Interview evaluation failed.";
  await prisma.aiCallLog.create({ data: { surface: "interview", latencyMs: Date.now() - startedAt, success: false, errorMessage: message.slice(0, 500), promptPreview: userPrompt.slice(0, 1200), responsePreview: raw.slice(0, 1200) } }).catch(() => undefined);
  return res.status(502).json({ error: "The AI evaluator is temporarily unavailable. Your answer is still here; retry when ready." });
 }
});

app.post("/api/interview/skip", async (req, res) => {
 if (!requirePasscode(req, res)) return;
 let body: Record<string, unknown>;
 try { body = jsonBody(req); } catch { return res.status(400).json({ error: "Invalid JSON request." }); }
 let identity: ReturnType<typeof interviewIdentity>;
 try { identity = interviewIdentity(body); } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Invalid session." }); }
 const company = typeof body.company === "string" ? body.company.trim() : "";
 const mode = typeof body.mode === "string" ? body.mode.trim() : "";
 const question = typeof body.question === "string" ? body.question.trim() : "";
 if (!company || !mode || !question) return res.status(400).json({ error: "Skip context is incomplete." });
 await prisma.interviewAttempt.upsert({
  where: { sessionId_questionIndex: { sessionId: identity.sessionId, questionIndex: identity.questionIndex } },
  update: { skipped: true, userAnswer: "", score: 0, dimensions: null, missingPoints: null, improvedAnswer: null },
  create: { sessionId: identity.sessionId, company, mode, questionIndex: identity.questionIndex, questionText: question, userAnswer: "", skipped: true, score: 0 },
 });
 return res.json({ success: true, sessionSummary: await sessionSummary(identity.sessionId, identity.sessionLength) });
});

app.all("*", async (req, res) => {
 const target = new URL(req.originalUrl, `http://127.0.0.1:${internalPort}`);
 const headers = new Headers();
 for (const [name, value] of Object.entries(req.headers)) {
  if (value === undefined || ["host", "content-length", "connection"].includes(name)) continue;
  headers.set(name, Array.isArray(value) ? value.join(",") : value);
 }
 const body = Buffer.isBuffer(req.body) && req.body.length ? req.body : undefined;
 try {
  const upstream = await fetch(target, { method: req.method, headers, body: body as any, redirect: "manual" });
  upstream.headers.forEach((value, name) => { if (!["content-encoding", "transfer-encoding", "connection"].includes(name.toLowerCase())) res.setHeader(name, value); });
  res.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
 } catch {
  res.status(502).json({ error: "Backend service is unavailable." });
 }
});

async function start() {
 const originalPort = process.env.PORT;
 process.env.PORT = String(internalPort);
 await import("./server");
 if (originalPort === undefined) delete process.env.PORT; else process.env.PORT = originalPort;
 app.listen(externalPort);
}

start().catch(() => process.exit(1));
