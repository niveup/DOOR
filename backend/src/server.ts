import express, { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { createAiProvider, AiProviderName } from "./lib/ai/provider";
import { decryptApiKey, encryptApiKey } from "./lib/ai/credentials";
import { jsonrepair } from "jsonrepair";

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
function getKolkataDate(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const dateString = formatter.format(date); // YYYY-MM-DD
  return new Date(dateString);
}

// Timezone-safe helper for current hour in Asia/Kolkata (0-23)
function getKolkataHour(date: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false
  });
  return parseInt(formatter.format(date), 10);
}

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

const aiProviderDefaults: Record<AiProviderName, string> = {
  openrouter: "openrouter/free",
  nvidia: "meta/llama-3.1-8b-instruct",
  cerebras: "gemma-4-31b",
};

let aiCredentialsInitialized = false;
let trackerStatusCache: { expiresAt: number; value: any } | null = null;

function isAiProviderName(value: unknown): value is AiProviderName {
  return value === "openrouter" || value === "nvidia" || value === "cerebras";
}

function environmentApiKey(provider: AiProviderName): string {
  if (provider === "nvidia") return process.env.NVIDIA_API_KEY || "";
  if (provider === "cerebras") return process.env.CEREBRAS_API_KEY || "";
  return process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY || "";
}

function environmentModel(provider: AiProviderName): string {
  if (provider === "openrouter") return process.env.AI_MODEL || aiProviderDefaults.openrouter;
  if (provider === "cerebras") return aiProviderDefaults.cerebras;
  return aiProviderDefaults.nvidia;
}

async function initializeAiCredentials(): Promise<void> {
  if (aiCredentialsInitialized) return;

  const existing = await prisma.aiProviderCredential.findMany();
  const existingProviders = new Set(existing.map((credential) => credential.provider));
  const preferredProvider: AiProviderName = 
    process.env.AI_PROVIDER === "nvidia" 
      ? "nvidia" 
      : process.env.AI_PROVIDER === "cerebras" 
        ? "cerebras" 
        : "openrouter";

  for (const provider of ["openrouter", "nvidia", "cerebras"] as AiProviderName[]) {
    const apiKey = environmentApiKey(provider);
    if (!apiKey || existingProviders.has(provider)) continue;

    const encrypted = encryptApiKey(apiKey);
    await prisma.aiProviderCredential.upsert({
      where: { provider },
      update: {},
      create: {
        provider,
        ...encrypted,
        model: environmentModel(provider),
        isActive: provider === preferredProvider && !existing.some((credential) => credential.isActive),
      },
    });
  }

  const activeCredential = await prisma.aiProviderCredential.findFirst({ where: { isActive: true } });
  if (!activeCredential) {
    const preferredCredential = await prisma.aiProviderCredential.findUnique({ where: { provider: preferredProvider } });
    const fallbackCredential = preferredCredential || await prisma.aiProviderCredential.findFirst();
    if (fallbackCredential) {
      await prisma.aiProviderCredential.update({
        where: { provider: fallbackCredential.provider },
        data: { isActive: true },
      });
    }
  }

  aiCredentialsInitialized = true;
}

async function resolveAiConfiguration(providerOverride?: AiProviderName) {
  await initializeAiCredentials();
  const credential = providerOverride
    ? await prisma.aiProviderCredential.findUnique({ where: { provider: providerOverride } })
    : await prisma.aiProviderCredential.findFirst({ where: { isActive: true } });

  if (!credential || !isAiProviderName(credential.provider)) {
    throw new Error("AI is not configured. Add an OpenRouter, NVIDIA, or Cerebras key in AI Control.");
  }

  return {
    provider: credential.provider,
    model: credential.model,
    apiKey: decryptApiKey(credential),
  };
}

async function aiChat(
  systemPrompt: string,
  userPrompt: string,
  options: { provider?: AiProviderName; model?: string; imageUrl?: string } = {}
): Promise<string> {
  const configuration = await resolveAiConfiguration(options.provider);
  const aiProvider = createAiProvider(configuration);
  return aiProvider.chat(systemPrompt, userPrompt, options.model, options.imageUrl);
}

async function publicAiConfiguration() {
  await initializeAiCredentials();
  const credentials = await prisma.aiProviderCredential.findMany({ orderBy: { provider: "asc" } });

  return {
    activeProvider: credentials.find((credential) => credential.isActive)?.provider || null,
    activeModel: credentials.find((credential) => credential.isActive)?.model || null,
    providers: (["openrouter", "nvidia", "cerebras"] as AiProviderName[]).map((provider) => {
      const credential = credentials.find((item) => item.provider === provider);
      return {
        provider,
        configured: Boolean(credential),
        keyHint: credential?.keyHint || null,
        model: credential?.model || environmentModel(provider),
        isActive: Boolean(credential?.isActive),
        updatedAt: credential?.updatedAt || null,
      };
    }),
  };
}

// --- Middleware ---

function passcodeAuth(req: Request, res: Response, next: NextFunction) {
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

app.use(passcodeAuth);

// --- API Endpoints ---

// Health Check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "healthy", timestamp: new Date() });
});

// Settings Getter
app.get("/api/settings", async (req: Request, res: Response) => {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Settings Updater
app.post("/api/settings", async (req: Request, res: Response) => {
  try {
    const { name, dailyAvailableHours, wakeTime, sleepTime, scoreWeights } = req.body;
    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: { name, dailyAvailableHours, wakeTime, sleepTime, scoreWeights },
      create: { id: "default", name, dailyAvailableHours, wakeTime, sleepTime, scoreWeights }
    });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/ai/config", async (_req: Request, res: Response) => {
  try {
    res.json(await publicAiConfiguration());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/ai/config", async (req: Request, res: Response) => {
  const { provider, model, apiKey } = req.body;
  if (!isAiProviderName(provider)) {
    return res.status(400).json({ error: "Choose OpenRouter, NVIDIA, or Cerebras." });
  }
  if (typeof model !== "string" || model.trim().length < 3 || model.trim().length > 160) {
    return res.status(400).json({ error: "Enter a valid model ID." });
  }
  if (apiKey && (typeof apiKey !== "string" || apiKey.trim().length < 10)) {
    return res.status(400).json({ error: "The API key looks incomplete." });
  }

  try {
    await initializeAiCredentials();
    const existing = await prisma.aiProviderCredential.findUnique({ where: { provider } });
    const resolvedApiKey = typeof apiKey === "string" && apiKey.trim()
      ? apiKey.trim()
      : existing
        ? decryptApiKey(existing)
        : environmentApiKey(provider);

    if (!resolvedApiKey) {
      const displayName = provider === "nvidia" ? "NVIDIA" : provider === "cerebras" ? "Cerebras" : "OpenRouter";
      return res.status(400).json({ error: `Add a ${displayName} API key first.` });
    }

    const encrypted = encryptApiKey(resolvedApiKey);
    await prisma.$transaction([
      prisma.aiProviderCredential.updateMany({ data: { isActive: false } }),
      prisma.aiProviderCredential.upsert({
        where: { provider },
        update: {
          ...encrypted,
          model: model.trim(),
          isActive: true,
        },
        create: {
          provider,
          ...encrypted,
          model: model.trim(),
          isActive: true,
        },
      }),
    ]);

    res.json(await publicAiConfiguration());
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/ai/models", async (req: Request, res: Response) => {
  const provider = req.query.provider;
  if (!isAiProviderName(provider)) {
    return res.status(400).json({ error: "Choose OpenRouter, NVIDIA, or Cerebras." });
  }

  try {
    const configuration = await resolveAiConfiguration(provider);
    const baseUrl = provider === "nvidia"
      ? "https://integrate.api.nvidia.com/v1"
      : provider === "cerebras"
        ? "https://api.cerebras.ai/v1"
        : "https://openrouter.ai/api/v1";
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${configuration.apiKey}` },
    });

    if (!response.ok) {
      const displayName = provider === "nvidia" ? "NVIDIA" : provider === "cerebras" ? "Cerebras" : "OpenRouter";
      throw new Error(`${displayName} returned ${response.status}.`);
    }

    const payload = await response.json() as { data?: Array<{ id?: string }> };
    const modelIds = (payload.data || [])
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id))
      .sort((a, b) => a.localeCompare(b));
    const prioritized = provider === "openrouter"
      ? ["openrouter/free", ...modelIds.filter((id) => id.endsWith(":free")), ...modelIds]
      : provider === "cerebras"
        ? ["gemma-4-31b", "llama-3.3-70b", "llama-3.1-8b", ...modelIds]
        : [
            "meta/llama-3.1-8b-instruct",
            "google/diffusiongemma-26b-a4b-it",
            "google/gemma-4-31b-it",
            "meta/llama-3.3-70b-instruct",
            ...modelIds,
          ];

    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({ models: [...new Set(prioritized)].slice(0, 160) });
  } catch (error: any) {
    res.status(502).json({ error: error.message, models: [environmentModel(provider)] });
  }
});

app.post("/api/ai/test", async (req: Request, res: Response) => {
  const provider = req.body?.provider;
  if (!isAiProviderName(provider)) {
    return res.status(400).json({ error: "Choose OpenRouter, NVIDIA, or Cerebras." });
  }

  const startedAt = Date.now();
  try {
    const configuration = await resolveAiConfiguration(provider);
    const response = await aiChat(
      "You are a connection test. Follow the requested output exactly.",
      "Reply with only the word READY.",
      { provider }
    );

    res.json({
      success: Boolean(response.trim()),
      provider,
      model: configuration.model,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: error.message,
      latencyMs: Date.now() - startedAt,
    });
  }
});

// System Prompt Preamble Getter
app.get("/api/settings/prompt", async (req: Request, res: Response) => {
  try {
    const promptsDir = path.join(process.cwd(), "prompts");
    const preamblePath = path.join(promptsDir, "_preamble.md");
    const promptContent = fs.readFileSync(preamblePath, "utf8");
    res.json({ prompt: promptContent });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// System Prompt Preamble Updater
app.post("/api/settings/prompt", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (typeof prompt !== "string") {
      return res.status(400).json({ error: "Invalid prompt content" });
    }
    const promptsDir = path.join(process.cwd(), "prompts");
    const preamblePath = path.join(promptsDir, "_preamble.md");
    fs.writeFileSync(preamblePath, prompt, "utf8");
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Submit Journal
app.post("/api/journal", async (req: Request, res: Response) => {
  const { entryText, mood, tags, studyDone, exerciseDone, readingDone } = req.body;
  const today = getKolkataDate();

  if (typeof entryText !== "string" || entryText.trim().length < 20 || entryText.length > 5000) {
    return res.status(400).json({ error: "Journal entry must be between 20 and 5000 characters." });
  }

  try {
    // 1. Save journal entry to database immediately for durability
    const journal = await prisma.journal.upsert({
      where: { date: today },
      update: { entryText, mood, tags, studyDone, exerciseDone, readingDone },
      create: { date: today, entryText, mood, tags, studyDone, exerciseDone, readingDone }
    });

    // 2. Fetch context for AI: settings, prior 7 journals, and weak subjects
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    const user_name = settings?.name || "Aspirant";

    const lastJournals = await prisma.journal.findMany({
      where: { date: { lt: today } },
      orderBy: { date: "desc" },
      take: 7
    });

    const historyContext = lastJournals.map((j: Journal) => 
      `- ${j.date.toISOString().split("T")[0]}: ${j.entryText} (Mood: ${j.mood || "N/A"})`
    ).join("\n");

    // Fetch weak subjects (ratings <= 2)
    const progressRatings = await prisma.progressRating.findMany({
      orderBy: [{ weekStartDate: "desc" }],
      distinct: ["subjectId"]
    });
    
    // Join with subject table to get names
    const subjects = await prisma.subject.findMany();
    const weakSubjects = progressRatings
      .filter((r: ProgressRating) => r.selfRating <= 2)
      .map((r: ProgressRating) => subjects.find((s: Subject) => s.subjectId === r.subjectId)?.subjectName || "")
      .filter(Boolean)
      .join(", ") || "None";

    // 3. Assemble prompt and call AI
    const systemPrompt = loadPrompt("journal.md", {
      user_name,
      date: today.toISOString().split("T")[0],
      entry_text: entryText,
      mood: mood || "N/A",
      tags: JSON.stringify(tags || []),
      history_context: historyContext || "No previous journal entries found.",
      weak_subjects: weakSubjects
    });

    const startTime = Date.now();
    let aiResponse = "";
    let success = true;
    let errorMessage: string | null = null;

    const requestedProvider = isAiProviderName(req.body?.aiProvider) ? req.body.aiProvider : undefined;
    const requestedModel = typeof req.body?.aiModel === "string" && req.body.aiModel.trim().length <= 160
      ? req.body.aiModel.trim()
      : undefined;
    try {
      aiResponse = await aiChat(
        "You are Jujum AI, a strict, honest Hinglish mentor.",
        systemPrompt,
        { provider: requestedProvider, model: requestedModel }
      );
    } catch (err: any) {
      success = false;
      errorMessage = err.message;
      console.error("AI Error:", err);
    }

    const latencyMs = Date.now() - startTime;

    // Log AI call
    await prisma.aiCallLog.create({
      data: {
        surface: "journal",
        latencyMs,
        success,
        errorMessage,
        promptPreview: systemPrompt,
        responsePreview: aiResponse
      }
    });

    if (success && aiResponse) {
      // 4. Parse 5 parts from response
      const parts = aiResponse.split("---").map(p => p.trim());
      
      const aiFeedback = parts[0] || "AI response formatting error.";
      const patternDetected = parts[2] || "None";
      const tomorrowTask = parts[3] || null;

      // 5. Update DB entry with feedback details
      const updatedJournal = await prisma.journal.update({
        where: { journalId: journal.journalId },
        data: { aiFeedback, tomorrowTask, patternDetected }
      });

      return res.json({
        success: true,
        journal: updatedJournal,
        rawAiOutput: aiResponse
      });
    } else {
      // Return saved journal but note AI error
      return res.json({
        success: false,
        journal,
        error: "AI mentor was temporarily unavailable, but your entry was saved safely. Retrying shortly.",
        friendlyMessage: "Aapka entry save ho gaya hai, par mentor abhi offline hai. Connection check kijiye."
      });
    }
  } catch (error: any) {
    console.error("Journal Submission Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/journal/history", async (req: Request, res: Response) => {
  try {
    const requestedLimit = Number(req.query.limit || 30);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 30, 1), 90);
    const entries = await prisma.journal.findMany({
      orderBy: { date: "desc" },
      take: limit,
      select: {
        journalId: true,
        date: true,
        entryText: true,
        mood: true,
        tags: true,
        tomorrowTask: true,
        patternDetected: true,
        studyDone: true,
        exerciseDone: true,
        readingDone: true,
        editedAt: true,
      },
    });

    res.json({ entries });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get Today's Routine Plan
app.get("/api/routine/today", async (req: Request, res: Response) => {
  const today = getKolkataDate();
  try {
    const plan = await prisma.routinePlan.findUnique({
      where: { date: today },
      include: { tasks: true }
    });
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Today's Routine Plan
app.delete("/api/routine/today", async (req: Request, res: Response) => {
  const today = getKolkataDate();
  try {
    await prisma.routinePlan.deleteMany({
      where: { date: today }
    });
    res.json({ success: true, message: "Today's plan has been cleared." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/routine/manual", async (req: Request, res: Response) => {
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  const mainPriority = typeof req.body?.mainPriority === "string" ? req.body.mainPriority.trim() : "";
  const validTaskTypes = new Set(["study", "exercise", "reading", "routine"]);

  if (tasks.length < 1 || tasks.length > 8) {
    return res.status(400).json({ error: "Add between 1 and 8 tasks." });
  }

  const normalizedTasks: Array<{
    title: string;
    taskType: "study" | "exercise" | "reading" | "routine";
    durationMin: number;
    isPriority: boolean;
  }> = tasks.map((task: any, index: number) => ({
    title: typeof task?.title === "string" ? task.title.trim() : "",
    taskType: validTaskTypes.has(task?.taskType) ? task.taskType : "study",
    durationMin: Math.round(Number(task?.durationMin)),
    isPriority: index === 0,
  }));

  if (normalizedTasks.some((task) => task.title.length < 2 || task.title.length > 180)) {
    return res.status(400).json({ error: "Every task needs a clear title." });
  }
  if (normalizedTasks.some((task) => !Number.isFinite(task.durationMin) || task.durationMin < 5 || task.durationMin > 480)) {
    return res.status(400).json({ error: "Task time must be between 5 and 480 minutes." });
  }

  const today = getKolkataDate();
  const totalEstimatedMin = normalizedTasks.reduce((total, task) => total + task.durationMin, 0);
  const planPriority = mainPriority || normalizedTasks[0].title;
  const planText = normalizedTasks
    .map((task, index) => `${index + 1}. ${task.title} (Duration: ${task.durationMin} mins)`)
    .join("\n");

  try {
    const plan = await prisma.$transaction(async (transaction) => {
      await transaction.routinePlan.deleteMany({ where: { date: today } });
      return transaction.routinePlan.create({
        data: {
          date: today,
          greeting: "Your plan is ready. Start with the first task.",
          planText,
          mainPriority: planPriority,
          totalEstimatedMin,
          isWeekend: today.getDay() === 0 || today.getDay() === 6,
          tasks: {
            create: normalizedTasks.map((task) => ({
              date: today,
              title: task.title,
              taskType: task.taskType,
              durationMin: task.durationMin,
              isPriority: task.isPriority,
              status: "NOT",
            })),
          },
        },
        include: { tasks: true },
      });
    });

    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/routine/plan-chat", async (req: Request, res: Response) => {
  const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const messages = rawMessages
    .filter((message: any) => message && (message.role === "user" || message.role === "assistant"))
    .map((message: any) => ({
      role: message.role as "user" | "assistant",
      content: String(message.content || "").trim().slice(0, 2000),
    }))
    .filter((message: { content: string }) => message.content.length > 0)
    .slice(-14);

  if (!messages.some((message: { role: string }) => message.role === "user")) {
    return res.status(400).json({ error: "Tell the planner what you want to work on first." });
  }

  try {
    const [settings, progressRatings, subjects, existingPlan, recentJournals, recentPlans] = await Promise.all([
      prisma.settings.findUnique({ where: { id: "default" } }),
      prisma.progressRating.findMany({
        orderBy: [{ weekStartDate: "desc" }],
        distinct: ["subjectId"],
      }),
      prisma.subject.findMany(),
      prisma.routinePlan.findUnique({
        where: { date: getKolkataDate() },
        include: { tasks: true },
      }),
      prisma.journal.findMany({
        orderBy: { date: "desc" },
        take: 7,
        select: {
          date: true,
          entryText: true,
          mood: true,
          tags: true,
          tomorrowTask: true,
          studyDone: true,
          exerciseDone: true,
          readingDone: true,
        },
      }),
      prisma.routinePlan.findMany({
        orderBy: { date: "desc" },
        take: 7,
        include: { tasks: true },
      }),
    ]);
    const weakSubjects = progressRatings
      .filter((rating: ProgressRating) => rating.selfRating <= 2)
      .map((rating: ProgressRating) => subjects.find((subject: Subject) => subject.subjectId === rating.subjectId)?.subjectName || "")
      .filter(Boolean)
      .join(", ") || "None logged";
    const conversation = messages
      .map((message: { role: "user" | "assistant"; content: string }) => `${message.role === "user" ? "Student" : "Planner"}: ${message.content}`)
      .join("\n");
    const userConversation = messages
      .filter((message: { role: string }) => message.role === "user")
      .map((message: { content: string }) => message.content)
      .join(" ");
    const durationMentions = [...userConversation.matchAll(/\b(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)\b/gi)]
      .map((match) => `${match[1]} ${match[2]}`);
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content || "";
    const confirmationDetected = /\b(yes|confirm|confirmed|looks good|create it|finalize|finalise|done|okay|ok|haan|theek)\b/i.test(latestUserMessage);
    const existingPlanText = existingPlan?.tasks.length
      ? existingPlan.tasks.map((task: Task) => `${task.title} (${task.durationMin} mins, ${task.status})`).join(", ")
      : "No plan yet";
    const recentJournalContext = recentJournals.length
      ? recentJournals.map((journal: any) =>
          `${journal.date.toISOString().split("T")[0]} | mood ${journal.mood || "not set"} | `
          + `done: study ${journal.studyDone}, exercise ${journal.exerciseDone}, reading ${journal.readingDone} | `
          + `next: ${journal.tomorrowTask || "none"} | entry: ${journal.entryText.slice(0, 500)}`
        ).join("\n")
      : "No journal history";
    const recentPlanContext = recentPlans.length
      ? recentPlans.map((plan: any) =>
          `${plan.date.toISOString().split("T")[0]} | `
          + plan.tasks.map((task: Task) => `${task.title} ${task.durationMin}m ${task.status}`).join("; ")
        ).join("\n")
      : "No previous plans";
    const explicitFacts = JSON.stringify({
      durationMentions: [...new Set(durationMentions)],
      latestUserMessage,
      confirmationDetected,
      currentPlanTaskCount: existingPlan?.tasks.length || 0,
    });
    const prompt = loadPrompt("plan_chat.md", {
      user_name: settings?.name || "Aspirant",
      available_hours: settings?.dailyAvailableHours || 4,
      weak_subjects: weakSubjects,
      existing_plan: existingPlanText,
      student_profile: JSON.stringify({
        targetExam: settings?.targetExam || "GATE",
        targetYear: settings?.targetYear || 2027,
        prepLevel: settings?.prepLevel || "Beginner",
        preferredLanguage: settings?.preferredLanguage || "hinglish",
        wakeTime: settings?.wakeTime || "06:00",
        sleepTime: settings?.sleepTime || "22:00",
        otherGoals: settings?.otherGoals || [],
      }),
      recent_journals: recentJournalContext,
      recent_plans: recentPlanContext,
      explicit_facts: explicitFacts,
      conversation,
    });

    const requestedProvider = isAiProviderName(req.body?.aiProvider) ? req.body.aiProvider : undefined;
    const requestedModel = typeof req.body?.aiModel === "string" && req.body.aiModel.trim().length <= 160
      ? req.body.aiModel.trim()
      : undefined;
    const aiResponse = await aiChat(
      "You are a collaborative study planner. The student has final control. Return valid JSON only.",
      prompt,
      { provider: requestedProvider, model: requestedModel }
    );
    const jsonStart = aiResponse.indexOf("{");
    const jsonEnd = aiResponse.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      throw new Error("Planner response did not contain JSON.");
    }

    const parsed = JSON.parse(jsonrepair(aiResponse.slice(jsonStart, jsonEnd + 1))) as {
      reply?: unknown;
      suggestions?: unknown;
      ready?: unknown;
      draftTasks?: unknown;
    };
    const validTaskTypes = new Set(["study", "exercise", "reading", "routine"]);
    let draftTasks = Array.isArray(parsed.draftTasks)
      ? parsed.draftTasks
          .map((task: any) => ({
            title: String(task?.title || "").trim().slice(0, 180),
            taskType: validTaskTypes.has(task?.taskType) ? task.taskType : "study",
            durationMin: Math.round(Number(task?.durationMin)),
          }))
          .filter((task: { title: string; durationMin: number }) =>
            task.title.length >= 2
            && Number.isFinite(task.durationMin)
            && task.durationMin >= 5
            && task.durationMin <= 480
          )
          .slice(0, 8)
      : [];
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map((suggestion) => String(suggestion).trim().slice(0, 100)).filter(Boolean).slice(0, 4)
      : [];

    let reply = String(parsed.reply || "What would you like to adjust?").trim().slice(0, 1200);
    let normalizedSuggestions = suggestions;
    if (durationMentions.length === 0) {
      const availableMinutes = Math.max(30, Math.round((settings?.dailyAvailableHours || 4) * 60));
      const timeOptions = availableMinutes < 60
        ? [15, 30, Math.min(45, availableMinutes)]
        : [30, 45, 60];
      reply = "Got it. How much time do you want to give this today? Choose one of these, or type your own time.";
      normalizedSuggestions = [...new Set(timeOptions)].map((minutes) => `${minutes} minutes`);
      draftTasks = [];
    } else if (draftTasks.length > 0 && /(how much time|kitna samay|time chahiye|how long)/i.test(reply)) {
      const totalMinutes = draftTasks.reduce((total: number, task: { durationMin: number }) => total + task.durationMin, 0);
      reply = `I have a ${totalMinutes}-minute draft from what you told me. Want to keep it, change the time, or add another task?`;
      normalizedSuggestions = ["Looks good", "Change the time", "Add another task"];
    } else if (draftTasks.length > 0 && normalizedSuggestions.length === 0) {
      normalizedSuggestions = ["Looks good", "Change the time", "Add another task"];
    }

    res.json({
      reply,
      suggestions: normalizedSuggestions,
      ready: (Boolean(parsed.ready) || confirmationDetected) && draftTasks.length > 0,
      draftTasks,
    });
  } catch (error: any) {
    res.status(502).json({ error: error.message });
  }
});

// Update Task Status (Check-off)
app.post("/api/tasks/:taskId/status", async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { status } = req.body; // "COMPLETED" | "PARTIAL" | "NOT"

  if (!["COMPLETED", "PARTIAL", "NOT"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    const task = await prisma.task.update({
      where: { taskId },
      data: { 
        status,
        finalizedAt: status !== "NOT" ? new Date() : null
      }
    });
    res.json(task);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function inferTaskType(title: string): "study" | "exercise" | "reading" | "routine" {
  const normalized = title.toLowerCase();
  if (/(exercise|workout|walk|run|stretch|gym)/.test(normalized)) return "exercise";
  if (/(read|book|article)/.test(normalized)) return "reading";
  if (/(routine|meditat|sleep|wake|plan|journal)/.test(normalized)) return "routine";
  return "study";
}

async function generateTodayRoutinePlan(replaceExisting: boolean) {
  const today = getKolkataDate();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const existingPlan = await prisma.routinePlan.findUnique({ where: { date: today } });

  if (existingPlan && !replaceExisting) {
    return { job: "generate_plan", status: "skipped_already_exists", planId: existingPlan.planId };
  }

  const [settings, yesterdayJournal, progressRatings, subjects] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.journal.findUnique({ where: { date: yesterday } }),
    prisma.progressRating.findMany({
      orderBy: [{ weekStartDate: "desc" }],
      distinct: ["subjectId"],
    }),
    prisma.subject.findMany(),
  ]);

  const userName = settings?.name || "Aspirant";
  const availableHours = settings?.dailyAvailableHours || 4;
  const tomorrowTask = yesterdayJournal?.tomorrowTask || "Study GATE Syllabus Core Topics";
  const weakSubjects = progressRatings
    .filter((rating: ProgressRating) => rating.selfRating <= 2)
    .map((rating: ProgressRating) => subjects.find((subject: Subject) => subject.subjectId === rating.subjectId)?.subjectName || "")
    .filter(Boolean)
    .join(", ") || "None";
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const systemPrompt = loadPrompt("routine_plan.md", {
    user_name: userName,
    date: today.toISOString().split("T")[0],
    streak_count: 5,
    tomorrow_task: tomorrowTask,
    weak_subjects: weakSubjects,
    available_hours: availableHours,
    available_minutes: availableHours * 60,
    max_minutes: Math.round(availableHours * 60 * 1.1),
    missed_tasks: "None",
    personal_habits: "Study in the morning, exercise in the evening.",
    is_weekend: isWeekend ? "Yes" : "No",
  });

  const startedAt = Date.now();
  let aiResponse = "";
  let aiError: string | null = null;
  try {
    aiResponse = await aiChat("You are Jujum AI, today's schedule coach.", systemPrompt);
  } catch (error: any) {
    aiError = error.message;
  }

  await prisma.aiCallLog.create({
    data: {
      surface: "routine_plan",
      latencyMs: Date.now() - startedAt,
      success: Boolean(aiResponse),
      errorMessage: aiError,
      promptPreview: systemPrompt,
      responsePreview: aiResponse,
    },
  });

  if (aiResponse) {
    const parsedTasks = aiResponse
      .split("\n")
      .map((line) => line.match(/^\s*\d+[.)]\s*(?:\[MAIN PRIORITY\]\s*)?(.*?)\s*\(Duration:\s*(\d+)\s*mins?\)/i))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match, index) => {
        const title = match[1].trim().replace(/\s+-\s+$/, "");
        return {
          title: title || "Study session",
          taskType: inferTaskType(title),
          durationMin: Math.max(5, Math.min(Number(match[2]) || 30, 480)),
          isPriority: index === 0,
        };
      })
      .slice(0, 8);

    if (parsedTasks.length === 0) {
      parsedTasks.push({
        title: tomorrowTask,
        taskType: "study",
        durationMin: Math.min(Math.max(Math.round(availableHours * 30), 45), 120),
        isPriority: true,
      });
    }

    const totalEstimatedMin = parsedTasks.reduce((total, task) => total + task.durationMin, 0);
    const greeting = aiResponse.match(/Greeting:\s*(.+)/i)?.[1]?.trim() || `Today is ready, ${userName}.`;
    const plan = await prisma.$transaction(async (transaction) => {
      if (existingPlan) {
        await transaction.routinePlan.delete({ where: { planId: existingPlan.planId } });
      }
      return transaction.routinePlan.create({
        data: {
          date: today,
          greeting,
          planText: aiResponse,
          mainPriority: parsedTasks[0]?.title || tomorrowTask,
          totalEstimatedMin,
          isWeekend,
          tasks: {
            create: parsedTasks.map((task) => ({
              date: today,
              title: task.title,
              taskType: task.taskType,
              durationMin: task.durationMin,
              isPriority: task.isPriority,
              status: "NOT",
            })),
          },
        },
        include: { tasks: true },
      });
    });

    return { job: "generate_plan", status: "completed", planId: plan.planId };
  }

  if (existingPlan) {
    return {
      job: "generate_plan",
      status: "failed_existing_preserved",
      planId: existingPlan.planId,
      error: aiError || "AI did not return a plan.",
    };
  }

  const fallbackPlan = await prisma.routinePlan.create({
    data: {
      date: today,
      greeting: "AI is offline, so a simple starter plan is ready.",
      planText: `1. ${tomorrowTask} (Duration: 90 mins)`,
      mainPriority: tomorrowTask,
      totalEstimatedMin: 90,
      isWeekend,
      tasks: {
        create: {
          date: today,
          title: tomorrowTask,
          taskType: "study",
          durationMin: 90,
          isPriority: true,
          status: "NOT",
        },
      },
    },
  });

  return {
    job: "generate_plan",
    status: "completed_fallback",
    planId: fallbackPlan.planId,
    error: aiError || "AI did not return a plan.",
  };
}

app.post("/api/routine/generate", async (req: Request, res: Response) => {
  try {
    const result = await generateTodayRoutinePlan(Boolean(req.body?.replace));
    const failed = result.status === "failed_existing_preserved";
    res.status(failed ? 502 : 200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
        // We could write dailyScore to routine_plan or logs as needed.
      }

      return res.json({ job: "finalize_yesterday", status: "completed" });
    }

    // 06:00 AM IST Cron - Generate Today's Routine Plan.
    // The dashboard can also force this so the user is not stuck waiting for 6 AM.
    const forcePlanGeneration = req.query.force === "plan";
    if (currentHour === 6 || forcePlanGeneration) {
      return res.json(await generateTodayRoutinePlan(false));
    }

    return res.json({ status: "ok", message: "Hour did not match any cron jobs. No actions run." });
  } catch (error: any) {
    console.error("Cron Processing Failure:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- Concept Explainer (Phase 2) ---

function cleanControlCharacters(aiResponse: string): string {
  return aiResponse
    .replace(/\x0c(rac|orall\b)/g, '\\\\f$1')
    .replace(/\x08(eta|ar|egin\b)/g, '\\\\b$1')
    .replace(/\u0009(heta|au|imes|anh|an|ext|ilde|o\b)/g, '\\\\t$1')
    .replace(/\r(ho\b)/g, '\\\\r$1')
    .replace(/\n(eq|abla|u|eg\b)/g, '\\\\n$1');
}

function cleanLatexEscapes(jsonStr: string): string {
  const latexKeywords = [
    'frac', 'beta', 'neq', 'rho', 'theta', 'tau', 'uparrow', 'downarrow',
    'bar', 'begin', 'times', 'tan', 'tanh', 'text', 'tilde', 'to', 'delta',
    'Delta', 'alpha', 'gamma', 'Gamma', 'omega', 'Omega', 'lambda', 'Lambda',
    'phi', 'Phi', 'psi', 'Psi', 'sigma', 'Sigma', 'pi', 'Pi', 'mu', 'nu',
    'eta', 'chi', 'xi', 'Xi', 'zeta', 'partial', 'infty', 'int', 'sum',
    'prod', 'lim', 'sqrt', 'log', 'ln', 'sin', 'cos', 'cot', 'sec', 'csc',
    'sinh', 'cosh', 'deg', 'div', 'grad', 'curl', 'nabla', 'pm', 'mp',
    'le', 'ge', 'approx', 'equiv', 'propto', 'parallel', 'perp', 'angle',
    'triangle', 'cup', 'cap', 'subset', 'subseteq', 'in', 'notin', 'ni',
    'forall', 'exists', 'neg', 'lor', 'land', 'implies', 'iff', 'leftarrow',
    'rightarrow', 'leftrightarrow', 'u'
  ];
  const latexRegex = new RegExp(`(?<!\\\\)\\\\(${latexKeywords.join('|')})\\b`, 'g');
  return jsonStr.replace(latexRegex, '\\\\$1');
}

/**
 * Strip markdown code fences (```json ... ```) that LLMs often wrap around JSON.
 */
function stripMarkdownFences(raw: string): string {
  // Remove leading ```json or ``` and trailing ```
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?\s*```\s*$/i, '');
  return cleaned.trim();
}

/**
 * Fix common JSON corruption patterns that LLMs produce:
 *  - Unescaped newlines inside string values
 *  - Trailing commas before } or ]
 *  - Single-quoted strings
 *  - Unquoted property names
 *  - Truncated JSON (missing closing braces)
 */
function aggressiveSanitize(jsonStr: string): string {
  let s = jsonStr;

  // Fix unescaped literal newlines/tabs inside strings by walking character by character
  // This is the #1 cause of "Expected ':' after property name" errors
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      result += ch;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }
    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
    }
    result += ch;
  }
  s = result;

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  // Balance braces: if truncated, close open braces/brackets
  let braces = 0;
  let brackets = 0;
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (ch === '{') braces++;
      if (ch === '}') braces--;
      if (ch === '[') brackets++;
      if (ch === ']') brackets--;
    }
  }
  // If we ended inside a string, close it
  if (inStr) s += '"';
  // Close any open brackets/braces
  while (brackets > 0) { s += ']'; brackets--; }
  while (braces > 0) { s += '}'; braces--; }

  return s;
}

/**
 * Robust multi-strategy JSON extractor. Tries 5 strategies in order:
 *  1. Direct parse after sanitization
 *  2. jsonrepair after sanitization
 *  3. Strip markdown fences + retry
 *  4. Aggressive sanitize (fix newlines, balance braces) + jsonrepair
 *  5. Extract a minimal valid object from the raw text
 *
 * Returns { data, error } — data is null only if ALL strategies fail.
 */
function robustJsonExtract(rawAiOutput: string): { data: any; error: string | null } {
  if (!rawAiOutput || rawAiOutput.trim().length === 0) {
    return { data: null, error: "AI returned empty response." };
  }

  // Pre-process: strip control chars and markdown fences
  let cleaned = cleanControlCharacters(rawAiOutput);
  cleaned = stripMarkdownFences(cleaned);

  // Extract the outermost { ... } block
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || start >= end) {
    return { data: null, error: "No JSON object boundaries found in AI response." };
  }

  const extracted = cleaned.substring(start, end + 1);

  // ── Strategy 1: Direct parse with LaTeX escape cleaning ──
  try {
    const s1 = cleanLatexEscapes(extracted);
    return { data: JSON.parse(s1), error: null };
  } catch { /* continue */ }

  // ── Strategy 2: jsonrepair on LaTeX-cleaned string ──
  try {
    const s2 = cleanLatexEscapes(extracted);
    const repaired = jsonrepair(s2);
    return { data: JSON.parse(repaired), error: null };
  } catch { /* continue */ }

  // ── Strategy 3: Aggressive sanitize (fix newlines, balance braces) + jsonrepair ──
  try {
    const s3 = aggressiveSanitize(cleanLatexEscapes(extracted));
    const repaired = jsonrepair(s3);
    return { data: JSON.parse(repaired), error: null };
  } catch { /* continue */ }

  // ── Strategy 4: Raw jsonrepair on original extracted text (no LaTeX cleaning) ──
  try {
    const s4 = aggressiveSanitize(extracted);
    const repaired = jsonrepair(s4);
    return { data: JSON.parse(repaired), error: null };
  } catch { /* continue */ }

  // ── Strategy 5: Build minimal fallback object from whatever we can extract ──
  try {
    const topicMatch = extracted.match(/"(?:topic|concept)"\s*:\s*"([^"]+)"/);
    const overviewMatch = extracted.match(/"(?:overview|summary)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const fallback: any = {
      session: {
        topic: topicMatch ? topicMatch[1] : "Explanation",
        difficulty: "Medium",
        exam_tags: ["GATE"],
        prerequisites: [],
        next_topics: []
      },
      overview: overviewMatch ? overviewMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : "The AI generated an explanation but it contained formatting errors. Here is a simplified version.",
      sections: [{
        id: "recovered-text",
        title: "Explanation (Recovered)",
        type: "text" as const,
        content: "The AI's response had formatting issues. Please try asking again or rephrase your question for a cleaner response."
      }],
      follow_up_questions: [],
      quiz: [],
      off_syllabus: false
    };

    // Try to recover any section content
    const contentMatches = extracted.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
    if (contentMatches && contentMatches.length > 0) {
      fallback.sections = contentMatches.slice(0, 6).map((m: string, i: number) => {
        const val = m.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        return {
          id: `recovered-${i}`,
          title: `Section ${i + 1}`,
          type: "text" as const,
          content: val ? val[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : ""
        };
      });
    }

    console.log("[AI JSON Recovery] All parse strategies failed. Returning recovered fallback object.");
    return { data: fallback, error: null };
  } catch (finalErr: any) {
    return { data: null, error: `All JSON parse strategies failed: ${finalErr.message}` };
  }
}

app.post("/api/explainer/query", async (req: Request, res: Response) => {
  const { topic, mode, deep, image, ocrText: providedOcrText, history } = req.body;
  const requestedProvider = isAiProviderName(req.body?.aiProvider) ? req.body.aiProvider : undefined;
  const requestedModel = typeof req.body?.aiModel === "string" && req.body.aiModel.trim().length <= 160
    ? req.body.aiModel.trim()
    : undefined;
  const requestedAiOptions = { provider: requestedProvider, model: requestedModel };
  if ((!topic || topic.trim().length < 2) && !image && !providedOcrText) {
    return res.status(400).json({ error: "Please enter a topic or upload an image." });
  }
  
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    const user_name = settings?.name || "Aspirant";
    const prep_level = settings?.prepLevel || "Beginner";
    
    const subjects = await prisma.subject.findMany();
    const subjectsList = subjects.map(s => `${s.subjectId}: ${s.subjectName}`).join("\n");

    // OCR: use provided ocrText if available, otherwise run Gemma Vision OCR on image
    let ocrText = providedOcrText || "";
    if (!ocrText && image) {
      try {
        console.log("[OCR] Using Gemma 4 Vision (google/gemma-4-31b-it) for image OCR...");
        const ocrResponse = await aiChat(
          "You are an expert OCR and image analysis tool. Extract ALL text, equations, diagrams, labels, and visual information from this image. Be extremely thorough and precise. Return the extracted content as plain text, preserving mathematical notation with LaTeX where appropriate.",
          `Analyze this image thoroughly. Extract every piece of text, equation, symbol, diagram label, and visual content you can see. The user wants to understand: "${topic || "What is in this image?"}"`,
          {
            ...requestedAiOptions,
            imageUrl: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`,
          }
        );
        ocrText = ocrResponse.trim();
        console.log("[OCR] Gemma 4 Vision extracted text. Length:", ocrText.length);
      } catch (ocrErr: any) {
        console.error("[OCR Gemma Vision Error]", ocrErr.message);
      }
    }

    let mergedTopic = topic || "";
    if (ocrText) {
      mergedTopic = `[User uploaded an image. Gemma Vision OCR extracted the following content from the image:\n${ocrText}\n\nUser's prompt/question: "${topic || "Explain this concept"}" ]`;
    }
    
    const systemPrompt = loadPrompt("explainer.md", {
      user_name,
      topic_input: mergedTopic,
      mode: deep ? `${mode || "detailed"} with deeper derivation and exam reasoning` : mode || "detailed",
      prep_level,
      subjects_list: subjectsList
    });

    let finalSystemPrompt = systemPrompt;
    if (Array.isArray(history) && history.length > 0) {
      const historyText = history.map((h: any) => {
        let contentStr = "";
        if (typeof h.content === "string") {
          try {
            const parsed = JSON.parse(h.content);
            const topicName = parsed.session?.topic || parsed.concept || "";
            const overviewStr = parsed.overview || parsed.summary || "";
            const sectionsList = parsed.sections || parsed.blocks || [];
            contentStr = `Concept: ${topicName}\nOverview: ${overviewStr}\nSections/Blocks: ${JSON.stringify(sectionsList)}`;
          } catch {
            contentStr = h.content;
          }
        } else if (h.content && typeof h.content === "object") {
          const topicName = h.content.session?.topic || h.content.concept || "";
          const overviewStr = h.content.overview || h.content.summary || "";
          const sectionsList = h.content.sections || h.content.blocks || [];
          contentStr = `Concept: ${topicName}\nOverview: ${overviewStr}\nSections/Blocks: ${JSON.stringify(sectionsList)}`;
        } else {
          contentStr = JSON.stringify(h.content);
        }
        return `${h.role === "user" ? "Student" : "Scholar"}: ${contentStr}`;
      }).join("\n\n");

      finalSystemPrompt += "\n\n## Conversation History:\n" + historyText +
        "\n\nStudent's new follow-up doubt: \"" + (topic || "") + "\"\n" +
        "Answer this follow-up doubt in detail based on the conversation history. You MUST return the response in the same JSON schema format (session, layout, off_syllabus, subject_id, overview, sections, follow_up_questions, quiz) specified in the system instructions. Make the session.topic represent the follow-up concept or keep it consistent with the previous topic.";
    }

    const startTime = Date.now();
    let aiResponse = "";
    let success = true;
    let errorMessage: string | null = null;
    let data: any = null;
    let parseSuccessful = false;

    // First attempt
    try {
      aiResponse = await aiChat(
        "You are Jujum AI, a private mentor helping a student prepare for the GATE exam and PSU recruitment. Return JSON only.",
        finalSystemPrompt,
        requestedAiOptions
      );

      const result = robustJsonExtract(aiResponse);
      if (result.data) {
        data = result.data;
        parseSuccessful = true;
      } else {
        errorMessage = result.error;
      }
    } catch (err: any) {
      success = false;
      errorMessage = err.message;
    }

    // Fallback attempt (stricter instructions) — only if first attempt completely failed
    if (!parseSuccessful) {
      console.log("[AI Fallback] First attempt failed JSON parsing. Retrying with stricter instructions.");
      success = true;
      errorMessage = null;
      try {
        const fallbackPrompt = finalSystemPrompt + "\n\nCRITICAL WARNING: Your previous response was invalid JSON. You must return ONLY the raw minified JSON object matching the requested schema, starting with { and ending with }. No conversation, no markdown codeblocks, and no wrapping in ```json. Do not use literal newlines inside string values — use \\n instead.";
        aiResponse = await aiChat(
          "You are a strict JSON responder. You must return ONLY a valid, minified JSON object matching the requested schema. Do not output anything else.",
          fallbackPrompt,
          requestedAiOptions
        );

        const result = robustJsonExtract(aiResponse);
        if (result.data) {
          data = result.data;
          parseSuccessful = true;
        } else {
          errorMessage = result.error;
        }
      } catch (err: any) {
        success = false;
        errorMessage = err.message;
      }
    }

    const latencyMs = Date.now() - startTime;

    await prisma.aiCallLog.create({
      data: {
        surface: "explainer",
        latencyMs,
        success: parseSuccessful && success,
        errorMessage: errorMessage || (parseSuccessful ? null : "JSON formatting check failed."),
        promptPreview: systemPrompt,
        responsePreview: aiResponse
      }
    });

    if (parseSuccessful && data) {
      // Normalize array data if jsonrepair wrapped multiple elements
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const root = data[0];
          if (root && typeof root === "object") {
            if (!root.sections && root.blocks) {
              root.sections = root.blocks;
            }
            if (!root.sections) {
              root.sections = [];
            }
            for (let i = 1; i < data.length; i++) {
              const item = data[i];
              if (item && typeof item === "object") {
                const targetList = root.sections || root.blocks || [];
                targetList.push(item);
              }
            }
            data = root;
          }
        }
      }

      const subjectId = Number(data.subject_id) || null;
      const explanation = await prisma.conceptExplanation.create({
        data: {
          topicInput: topic || "Uploaded Image",
          normalizedTopic: data.session?.topic || data.concept || topic || "Uploaded Image Analysis",
          subjectId: subjects.some(s => s.subjectId === subjectId) ? subjectId : null,
          mode: mode || "detailed",
          explanationText: JSON.stringify(data)
        }
      });

      return res.json({
        explanationId: explanation.explanationId,
        data,
        ocrExtracted: ocrText || null
      });
    } else {
      return res.status(500).json({ 
        error: "AI response failed JSON formatting check. Please try again.",
        details: errorMessage || "Failed to parse final AI response as JSON.",
        rawOutput: aiResponse
      });
    }
  } catch (error: any) {
    console.error("Explainer API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- Progress Tracker (Phase 2) ---

app.post("/api/tracker/rating", async (req: Request, res: Response) => {
  const { subjectId, selfRating, hoursStudied, questionsSolved, confidenceLevel, notes } = req.body;
  
  if (!subjectId || !selfRating || selfRating < 1 || selfRating > 5) {
    return res.status(400).json({ error: "subjectId and selfRating (1-5) are required." });
  }

  try {
    const today = getKolkataDate();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));

    const rating = await prisma.progressRating.upsert({
      where: {
        subjectId_weekStartDate: {
          subjectId: Number(subjectId),
          weekStartDate: monday
        }
      },
      update: {
        selfRating: Number(selfRating),
        hoursStudied: Number(hoursStudied || 0.0),
        questionsSolved: Number(questionsSolved || 0),
        confidenceLevel: Number(confidenceLevel || 3),
        notes: notes || null
      },
      create: {
        subjectId: Number(subjectId),
        weekStartDate: monday,
        selfRating: Number(selfRating),
        hoursStudied: Number(hoursStudied || 0.0),
        questionsSolved: Number(questionsSolved || 0),
        confidenceLevel: Number(confidenceLevel || 3),
        notes: notes || null
      }
    });

    trackerStatusCache = null;
    res.json(rating);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/tracker/status", async (req: Request, res: Response) => {
  try {
    if (trackerStatusCache && trackerStatusCache.expiresAt > Date.now()) {
      res.setHeader("X-Tracker-Cache", "hit");
      return res.json(trackerStatusCache.value);
    }

    const [subjects, ratings] = await Promise.all([
      prisma.subject.findMany({ orderBy: { subjectId: "asc" } }),
      prisma.progressRating.findMany({
        orderBy: [{ subjectId: "asc" }, { weekStartDate: "desc" }],
        select: {
          subjectId: true,
          selfRating: true,
          hoursStudied: true,
          questionsSolved: true,
          confidenceLevel: true,
          weekStartDate: true,
        },
      }),
    ]);
    const now = getKolkataDate();
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

    const ratingsBySubject = new Map<number, typeof ratings>();
    for (const rating of ratings) {
      const subjectRatings = ratingsBySubject.get(rating.subjectId) || [];
      if (subjectRatings.length < 2) {
        subjectRatings.push(rating);
        ratingsBySubject.set(rating.subjectId, subjectRatings);
      }
    }

    const ratingsList = subjects.map((subject) => {
      const recentRatings = ratingsBySubject.get(subject.subjectId) || [];
      const latestRating = recentRatings[0] || null;
      const isNeglected = latestRating
        ? latestRating.weekStartDate < threeWeeksAgo
        : true;
      const hasAvoidanceWarning = recentRatings.length >= 2
        && recentRatings.every((rating) => rating.selfRating <= 2);

      return {
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        importanceLevel: subject.importanceLevel,
        topics: subject.topics,
        latestRating: latestRating ? latestRating.selfRating : null,
        hoursStudied: latestRating ? latestRating.hoursStudied : 0,
        questionsSolved: latestRating ? latestRating.questionsSolved : 0,
        confidenceLevel: latestRating ? latestRating.confidenceLevel : null,
        isNeglected,
        hasAvoidanceWarning
      };
    });

    const sumRatings = ratingsList.reduce((acc, r) => acc + (r.latestRating || 0), 0);
    const overallReadiness = Math.round((sumRatings / 70) * 100);
    const value = {
      overallReadiness,
      subjects: ratingsList
    };

    trackerStatusCache = { value, expiresAt: Date.now() + 300_000 };
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Tracker-Cache", "miss");
    res.json(value);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Server Listen ---

app.listen(PORT, () => {
  console.log(`Backend server successfully running on port ${PORT}`);
});
