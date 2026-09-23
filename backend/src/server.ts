import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { createAiProvider, AiProviderName } from "./lib/ai/provider";
import { resolveAiConfiguration, isAiProviderName } from "./lib/ai/boot";
import { isPasscodeConfigured, verifySharedSecret } from "./lib/auth";
import { getKolkataDate, getKolkataHour, getKolkataDateString } from "./lib/time";
import { createRateLimiter, clientKey } from "./lib/rate-limit";
import { pushBackup } from "./lib/backup-store";
import { registerTrackerRoutes } from "./routes/tracker";
import { registerJournalRoutes } from "./routes/journal";
import { registerExplainerRoutes } from "./routes/explainer";
import { registerRoutineRoutes } from "./routes/routine";
import { registerFinanceRoutes } from "./routes/finance";

// GA-102: brute-force brake on credential failures + a generous global cap.
const authFailureLimiter = createRateLimiter({ windowMs: 5 * 60_000, max: 10 });
const apiCapLimiter = createRateLimiter({ windowMs: 60_000, max: 300 });
// AI surfaces are the paid endpoints; 30/min per client is far above human use
// but stops scripted wallet-drain instantly.
const aiSpendLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

function allowAiSpend(req: Request, res: Response): boolean {
  const result = aiSpendLimiter.hit(clientKey(req));
  if (result.allowed) return true;
  res.status(429).set("Retry-After", String(result.retryAfterSeconds))
    .json({ error: "Too many AI requests. Please wait a moment and try again." });
  return false;
}

// Stub types for initial compilation prior to running 'prisma generate'
type Journal = any;
type ProgressRating = any;
type Subject = any;
type Task = any;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.ALLOWED_ORIGINS || (isProduction ? "" : "http://localhost:3000"))
 .split(",").map((value) => value.trim()).filter(Boolean);
if (isProduction && allowedOrigins.length === 0) throw new Error("ALLOWED_ORIGINS is required in production.");

app.use(cors({
  origin: (origin, callback) => {
    console.log(`[CORS] Checking Origin: ${origin}`);
    if (!origin) {
      console.log(`[CORS] Allowed (No Origin)`);
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`[CORS] Allowed (In Allowed List): ${origin}`);
      return callback(null, true);
    }
    
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      const isLocalIp = 
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("172.16.") ||
        hostname.endsWith(".local");

      if (!isProduction && isLocalIp) {
        console.log(`[CORS] Allowed (Local IP): ${origin}`);
        return callback(null, true);
      }
    } catch (e) {
      console.error(`[CORS] URL Parse Error:`, e);
    }
    
    console.log(`[CORS] Blocked: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "x-passcode", "x-cron-secret"]
}));

app.use(express.json({ limit: "64kb" }));

// --- Helper Functions ---

// Timezone-safe helper for Asia/Kolkata date YYYY-MM-DD
// Load and interpolate prompt variables
function loadPrompt(filename: string, variables: Record<string, any> = {}): string {
  const promptsDir = path.join(process.cwd(), "prompts");
  const preamble = fs.readFileSync(path.join(promptsDir, "_preamble.md"), "utf8");
  const template = fs.readFileSync(path.join(promptsDir, filename), "utf8");
  
  let fullPrompt = `${preamble}\n\n${template}`;
  
  for (const [key, value] of Object.entries(variables)) {
    fullPrompt = fullPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  
  return fullPrompt;
}

async function aiChat(
  systemPrompt: string,
  userPrompt: string,
  options: { provider?: AiProviderName; model?: string; imageUrl?: string } = {}
): Promise<string> {
  const configuration = await resolveAiConfiguration(prisma, options.provider);
  const aiProvider = createAiProvider(configuration);
  return aiProvider.chat(systemPrompt, userPrompt, options.model, options.imageUrl);
}

// --- Middleware ---

function passcodeAuth(req: Request, res: Response, next: NextFunction) {
 if (req.path === "/health") return next();
 const key = clientKey(req);
 const cap = apiCapLimiter.hit(key);
 if (!cap.allowed) {
   res.set("Retry-After", String(cap.retryAfterSeconds));
   return res.status(429).json({ error: "Too many requests. Slow down." });
 }
 const expectedCron = process.env.CRON_SHARED_SECRET;
 const cronHeader = typeof req.headers["x-cron-secret"] === "string" ? req.headers["x-cron-secret"] : "";
 if (req.path.startsWith("/cron") && expectedCron && cronHeader && crypto.timingSafeEqual(crypto.createHash("sha256").update(cronHeader).digest(), crypto.createHash("sha256").update(expectedCron).digest())) return next();
 if (!isPasscodeConfigured(process.env.APP_PASSCODE)) return res.status(503).json({ error: "Backend authentication is not configured." });
 const brake = authFailureLimiter.peek(key);
 if (!brake.allowed) {
   res.set("Retry-After", String(brake.retryAfterSeconds));
   return res.status(429).json({ error: "Too many failed attempts. Try again later." });
 }
 const expected = process.env.APP_PASSCODE as string;
 const received = typeof req.headers["x-passcode"] === "string" ? req.headers["x-passcode"] : "";
 if (!verifySharedSecret(received, expected)) {
   authFailureLimiter.hit(key);
   return res.status(401).json({ error: "Unauthorized" });
 }
 authFailureLimiter.reset(key);
 return next();
}

app.use(passcodeAuth);

// Mobile clients use this authenticated no-op to validate a locally stored
// passcode without exposing any account data or treating /health as proof of
// authentication.
app.get("/api/auth/verify", (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store").json({ success: true });
});

registerJournalRoutes(app, prisma, { allowAiSpend, loadPrompt, aiChat });

// --- API Endpoints ---

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

registerRoutineRoutes(app, prisma, { allowAiSpend, loadPrompt, isAiProviderName, aiChat });

// --- Cron Processing Tick Handler ---

app.get("/cron/tick", async (req: Request, res: Response) => {
  const now = new Date();
  const currentHour = getKolkataHour(now);
  const today = getKolkataDate(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  console.log(`[Cron Tick] Time: ${now.toISOString()} | Kolkata Hour: ${currentHour} | Today: ${today.toISOString().split("T")[0]}`);

  try {
    // 04:00 AM IST Cron - Finalize Yesterday Score & Streaks & Comeback Check
    if (currentHour === 4) {
      // 1. Check idempotency: Did we already run finalization today?
      // Since score weights are saved, we check if yesterday's routine plan score has been calculated
      const yesterdayPlan = await prisma.routinePlan.findUnique({
        where: { date: yesterday },
        include: { tasks: true }
      });

      if (yesterdayPlan) {
        // Calculate score
        const settings = await prisma.settings.findUnique({ where: { id: "default" } });
        const weights = (settings?.scoreWeights as any) || { study: 60, exercise: 15, reading: 10, routine: 15 };
        
        // Group tasks by type and check completed status
        // Completed = 100%, Partial = 50%, Not = 0%
        let studyScore = 0;
        let exerciseScore = 0;
        let readingScore = 0;
        let routineScore = 0;

        const getTaskTypeMultiplier = (status: string) => {
          if (status === "COMPLETED") return 1;
          if (status === "PARTIAL") return 0.5;
          return 0;
        };

        const studyTasks = yesterdayPlan.tasks.filter((t: Task) => t.taskType === "study");
        const exerciseTasks = yesterdayPlan.tasks.filter((t: Task) => t.taskType === "exercise");
        const readingTasks = yesterdayPlan.tasks.filter((t: Task) => t.taskType === "reading");
        const routineTasks = yesterdayPlan.tasks.filter((t: Task) => t.taskType === "routine");

        const calculateTypeScore = (tasks: Task[]) => {
          if (tasks.length === 0) return 0;
          const sum = tasks.reduce((acc: number, t: Task) => acc + getTaskTypeMultiplier(t.status), 0);
          return (sum / tasks.length) * 100;
        };

        studyScore = calculateTypeScore(studyTasks);
        exerciseScore = calculateTypeScore(exerciseTasks);
        readingScore = calculateTypeScore(readingTasks);
        routineScore = calculateTypeScore(routineTasks);

        const dailyScore = Math.round(
          (studyScore * weights.study +
           exerciseScore * weights.exercise +
           readingScore * weights.reading +
           routineScore * weights.routine) / 100
        );

        console.log(`[Cron 04:00] Calculated score for yesterday: ${dailyScore}/100`);
      }

      // Weekly backup (GA-112): Mondays 04:00 IST, after finalization.
      if (getKolkataDate(now).getDay() === 1) {
        try {
          const backup = await pushBackup(prisma);
          console.log("[Cron Backup]", JSON.stringify(backup));
        } catch (backupError) {
          console.error("[Cron Backup] failed:", backupError instanceof Error ? backupError.message : backupError);
        }
      }

      return res.json({ job: "finalize_yesterday", status: "completed" });
    }

    return res.json({ status: "ok", message: "Hour did not match any cron jobs. No actions run." });
  } catch (error: any) {
    console.error("Cron Processing Failure:", error);
    res.status(500).json({ error: error.message });
  }
});

registerExplainerRoutes(app, { allowAiSpend, loadPrompt, isAiProviderName, aiChat });

registerTrackerRoutes(app, prisma);

registerFinanceRoutes(app, prisma);

// --- Server Listen ---

// Manual backup run (GA-112): passcode-gated like every other route.
app.post("/api/backup/run", async (_req: Request, res: Response) => {
  try {
    const backup = await pushBackup(prisma);
    if (!backup.pushed) return res.status(502).json({ success: false, ...backup });
    res.json({ success: true, ...backup });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server successfully running on port ${PORT}`);
});

