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
import { listPrivateJournalEntries, privateJournalByDate, savePrivateJournalEntry } from "./lib/private-journal-store";
import { saveStudyLogToD1, fetchStudyLogsFromD1, clearTrackerLogsInD1 } from "./lib/private-tracker-store";

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

// Timezone-safe helper to get Monday of the current week in Asia/Kolkata
function getKolkataMonday(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const dateString = formatter.format(date); // YYYY-MM-DD
  const parts = dateString.split("-").map(Number);
  const kolkataDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const day = kolkataDate.getUTCDay();
  const diff = kolkataDate.getUTCDate() - day + (day === 0 ? -6 : 1);
  kolkataDate.setUTCDate(diff);
  return kolkataDate;
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

// A temporary D1 outage should reduce journal context, not take the planner or
// coach offline. This intentionally never falls back to the retired plaintext store.
async function privateJournalEntriesOrEmpty(limit: number) {
  try {
    return await listPrivateJournalEntries(limit);
  } catch (error) {
    console.error("Private journal context unavailable", error instanceof Error ? error.message : "unknown error");
    return [];
  }
}

async function privateJournalByDateOrNull(date: Date) {
  try {
    return await privateJournalByDate(date);
  } catch (error) {
    console.error("Private journal context unavailable", error instanceof Error ? error.message : "unknown error");
    return null;
  }
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

// Mobile clients use this authenticated no-op to validate a locally stored
// passcode without exposing any account data or treating /health as proof of
// authentication.
app.get("/api/auth/verify", (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store").json({ success: true });
});

// Journal records used to be persisted through these PostgreSQL endpoints.
// Leave them unavailable so an app-level passcode can never bypass the private
// journal's separate lock, encryption, and D1 service authentication.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/api/journal") {
    return res.status(410).set("Cache-Control", "no-store").json({ error: "The legacy journal endpoint is retired." });
  }
  return next();
});

// Private mobile journal contract. Journal encryption and the D1 service
// credentials stay server-side; the phone only submits its passcode-authenticated
// entry over HTTPS.
app.get("/api/journal/entry", async (req: Request, res: Response) => {
  const date = typeof req.query.date === "string" ? req.query.date : getKolkataDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD." });
  try {
    const entry = await privateJournalByDate(new Date(`${date}T00:00:00.000Z`));
    res.set("Cache-Control", "no-store, private").json({ entry });
  } catch (error: any) {
    res.status(503).set("Cache-Control", "no-store").json({ error: error.message || "Private journal storage is unavailable." });
  }
});

app.post("/api/journal/entry", async (req: Request, res: Response) => {
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  const mood = typeof req.body?.mood === "string" ? req.body.mood.slice(0, 20) : null;
  const tags = Array.isArray(req.body?.tags)
    ? req.body.tags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.length <= 40).slice(0, 6)
    : [];
  const date = typeof req.body?.date === "string" ? req.body.date : getKolkataDateString();
  if (content.length < 20 || content.length > 5000 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).set("Cache-Control", "no-store").json({ error: "Journal content must be 20–5000 characters and date must be YYYY-MM-DD." });
  }

  try {
    const [settings, history] = await Promise.all([
      prisma.settings.findUnique({ where: { id: "default" } }),
      listPrivateJournalEntries(7),
    ]);
    const historyContext = history
      .filter((item) => item.date.toISOString().slice(0, 10) !== date)
      .map((item) => `- ${item.date.toISOString().slice(0, 10)}: ${item.entryText} (Mood: ${item.mood || "N/A"})`)
      .join("\n") || "No previous journal entries found.";
    const prompt = loadPrompt("journal.md", {
      user_name: settings?.name || "Aspirant",
      date,
      entry_text: content,
      mood: mood || "N/A",
      tags: JSON.stringify(tags),
      history_context: historyContext,
      weak_subjects: "Not requested for this private response",
    });
    const feedback = await aiChat(
      "You are Jujum AI, a strict, honest Hinglish mentor. Return five clear sections separated by ---.",
      prompt,
    );
    const parts = feedback.split("---").map((part) => part.trim());
    const entry = await savePrivateJournalEntry(date, {
      entryText: content,
      mood,
      tags,
      aiFeedback: feedback,
      tomorrowTask: parts[3] || null,
      patternDetected: parts[2] || null,
      studyDone: false,
      exerciseDone: false,
      readingDone: false,
    });
    res.set("Cache-Control", "no-store, private").json({ entry, feedback, tomorrowTask: entry.tomorrowTask });
  } catch (error: any) {
    console.error("Private mobile journal failed", error instanceof Error ? error.message : "unknown error");
    res.status(502).set("Cache-Control", "no-store").json({ error: "Your journal could not be saved securely right now." });
  }
});

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

// Private-journal feedback only. Persistence is intentionally handled by the
// encrypted Cloudflare D1 journal store, not by this service or its AI logs.
app.post("/api/journal/feedback", async (req: Request, res: Response) => {
  const entryText = typeof req.body?.entryText === "string" ? req.body.entryText.trim() : "";
  const mood = typeof req.body?.mood === "string" ? req.body.mood : null;
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.filter((tag: unknown): tag is string => typeof tag === "string").slice(0, 6) : [];
  const studyDone = req.body?.studyDone === true;
  const exerciseDone = req.body?.exerciseDone === true;
  const readingDone = req.body?.readingDone === true;
  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(0, 7).map((item: unknown) => {
      const entry = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        date: typeof entry.date === "string" ? entry.date.slice(0, 10) : "",
        entryText: typeof entry.entryText === "string" ? entry.entryText.slice(0, 5000) : "",
        mood: typeof entry.mood === "string" ? entry.mood.slice(0, 20) : "N/A",
      };
    }).filter((item: { entryText: string }) => item.entryText.length > 0)
    : [];

  if (entryText.length < 20 || entryText.length > 5000 || !mood || !["1", "2", "3", "4", "5"].includes(mood)) {
    return res.status(400).set("Cache-Control", "no-store").json({ error: "Journal feedback input is invalid." });
  }

  try {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    const historyContext = history.length
      ? history.map((entry: { date: string; entryText: string; mood: string }) => `- ${entry.date}: ${entry.entryText} (Mood: ${entry.mood})`).join("\n")
      : "No previous journal entries found.";
    const systemPrompt = loadPrompt("journal.md", {
      user_name: settings?.name || "Aspirant",
      date: getKolkataDate().toISOString().split("T")[0],
      entry_text: entryText,
      mood,
      tags: JSON.stringify(tags),
      history_context: historyContext,
      weak_subjects: "Not requested for this private response",
    });
    const requestedProvider = isAiProviderName(req.body?.aiProvider) ? req.body.aiProvider : undefined;
    const requestedModel = typeof req.body?.aiModel === "string" && req.body.aiModel.trim().length <= 160
      ? req.body.aiModel.trim()
      : undefined;
    const aiResponse = await aiChat(
      "You are Jujum AI, a strict, honest Hinglish mentor. Do not retain or repeat private journal text beyond your response.",
      systemPrompt,
      { provider: requestedProvider, model: requestedModel }
    );
    const parts = aiResponse.split("---").map((part) => part.trim());
    res.set({ "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" }).json({
      aiFeedback: parts[0] || "Your entry is saved. Revisit the facts and choose one small next step.",
      patternDetected: parts[2] || null,
      tomorrowTask: parts[3] || null,
    });
  } catch (error) {
    console.error("Private journal feedback failed", error instanceof Error ? error.message : "unknown error");
    res.status(502).set("Cache-Control", "no-store").json({ error: "Mentor feedback is temporarily unavailable." });
  }
});

app.get("/api/journal/history", async (req: Request, res: Response) => {
  try {
    const requestedLimit = Number(req.query.limit || 30);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 30, 1), 90);
    const entries = await listPrivateJournalEntries(limit);
    res.set("Cache-Control", "no-store, private").json({ entries });
  } catch (error: any) {
    res.status(503).set("Cache-Control", "no-store").json({ error: error.message || "Private journal storage is unavailable." });
  }
});

// Get Routine Plan (by optional date query param, defaults to today)
app.get("/api/routine/today", async (req: Request, res: Response) => {
  const dateQuery = req.query.date as string;
  const targetDate = dateQuery ? new Date(dateQuery) : getKolkataDate();
  try {
    const plan = await prisma.routinePlan.findUnique({
      where: { date: targetDate },
      include: { tasks: true }
    });
    res.json(plan);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete Routine Plan (by optional date query param, defaults to today)
app.delete("/api/routine/today", async (req: Request, res: Response) => {
  const dateQuery = req.query.date as string;
  const targetDate = dateQuery ? new Date(dateQuery) : getKolkataDate();
  try {
    await prisma.routinePlan.deleteMany({
      where: { date: targetDate }
    });
    res.json({ success: true, message: "Plan has been cleared." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/routine/manual", async (req: Request, res: Response) => {
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  const mainPriority = typeof req.body?.mainPriority === "string" ? req.body.mainPriority.trim() : "";
  const validTaskTypes = new Set(["study", "exercise", "reading", "routine"]);

  if (tasks.length < 1 || tasks.length > 30) {
    return res.status(400).json({ error: "Add between 1 and 30 tasks." });
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

  const dateQuery = req.query.date as string;
  const targetDate = dateQuery ? new Date(dateQuery) : getKolkataDate();
  const totalEstimatedMin = normalizedTasks.reduce((total, task) => total + task.durationMin, 0);
  const planPriority = mainPriority || normalizedTasks[0].title;
  const planText = normalizedTasks
    .map((task, index) => `${index + 1}. ${task.title} (Duration: ${task.durationMin} mins)`)
    .join("\n");

  try {
    const plan = await prisma.$transaction(async (transaction) => {
      await transaction.routinePlan.deleteMany({ where: { date: targetDate } });
      return transaction.routinePlan.create({
        data: {
          date: targetDate,
          greeting: "Your plan is ready. Start with the first task.",
          planText,
          mainPriority: planPriority,
          totalEstimatedMin,
          isWeekend: targetDate.getDay() === 0 || targetDate.getDay() === 6,
          tasks: {
            create: normalizedTasks.map((task) => ({
              date: targetDate,
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
      privateJournalEntriesOrEmpty(7),
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
    const rawDraftTasks = Array.isArray(req.body?.draftTasks)
      ? req.body.draftTasks
      : Array.isArray(req.body?.currentDraft)
        ? req.body.currentDraft
        : [];

    const currentDraftText = rawDraftTasks.length > 0
      ? rawDraftTasks.map((t: any, i: number) => `${i + 1}. ${t.title || "Task"} (${t.durationMin || 0}m, ${t.taskType || "study"})`).join(", ")
      : "No tasks in live draft board yet";

    const explicitFacts = JSON.stringify({
      durationMentions: [...new Set(durationMentions)],
      latestUserMessage,
      confirmationDetected,
      currentPlanTaskCount: existingPlan?.tasks.length || 0,
      userDraftTaskCount: rawDraftTasks.length,
    });

    const prompt = loadPrompt("plan_chat.md", {
      user_name: settings?.name || "Aspirant",
      available_hours: 24,
      weak_subjects: weakSubjects,
      existing_plan: existingPlanText,
      current_draft_tasks: currentDraftText,
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

    // If AI returned no new draft tasks but user already had manual draft tasks, preserve user's manual draft
    if (draftTasks.length === 0 && rawDraftTasks.length > 0) {
      draftTasks = rawDraftTasks.map((task: any) => ({
        title: String(task?.title || "").trim().slice(0, 180),
        taskType: validTaskTypes.has(task?.taskType) ? task.taskType : "study",
        durationMin: Math.round(Number(task?.durationMin)) || 30,
      }));
    }

    let suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map((suggestion) => String(suggestion).trim().slice(0, 100)).filter(Boolean).slice(0, 4)
      : [];

    let reply = String(parsed.reply || "What would you like to adjust?").trim().slice(0, 1200);

    // Fallback default suggestions only if AI generated none
    if (suggestions.length === 0) {
      if (draftTasks.length > 0) {
        suggestions = ["Haan, looks good", "Change time", "Add another task"];
      } else {
        suggestions = ["45 minutes study", "30 minutes study", "60 minutes study"];
      }
    }

    res.json({
      reply,
      suggestions,
      ready: (Boolean(parsed.ready) || confirmationDetected) && draftTasks.length > 0,
      draftTasks,
    });
  } catch (error: any) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/routine/general-chat", async (req: Request, res: Response) => {
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
    return res.status(400).json({ error: "Ask the coach a question first." });
  }

  try {
    const [settings, progressRatings, subjects, existingPlan, recentJournals] = await Promise.all([
      prisma.settings.findUnique({ where: { id: "default" } }),
      prisma.progressRating.findMany({
        orderBy: [{ weekStartDate: "desc" }],
      }),
      prisma.subject.findMany({ orderBy: { subjectId: "asc" } }),
      prisma.routinePlan.findUnique({
        where: { date: getKolkataDate() },
        include: { tasks: true },
      }),
      privateJournalEntriesOrEmpty(5),
    ]);

    const ratingsBySubject = new Map<number, any[]>();
    for (const r of progressRatings) {
      const list = ratingsBySubject.get(r.subjectId) || [];
      if (list.length < 2) {
        list.push(r);
        ratingsBySubject.set(r.subjectId, list);
      }
    }

    const now = getKolkataDate();
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

    const ratingsList = subjects.map((subject) => {
      const recentRatings = ratingsBySubject.get(subject.subjectId) || [];
      const latestRating = recentRatings[0] || null;
      const isNeglected = latestRating
        ? latestRating.weekStartDate < threeWeeksAgo
        : true;
      const hasAvoidanceWarning = recentRatings.length >= 2
        && recentRatings.every((r) => r.selfRating <= 2);

      return {
        subjectName: subject.subjectName,
        importanceLevel: subject.importanceLevel,
        latestRating: latestRating ? latestRating.selfRating : null,
        hoursStudied: latestRating ? latestRating.hoursStudied : 0,
        questionsSolved: latestRating ? latestRating.questionsSolved : 0,
        isNeglected,
        hasAvoidanceWarning
      };
    });

    const sumRatings = ratingsList.reduce((acc, r) => acc + (r.latestRating || 0), 0);
    const overallReadiness = Math.round((sumRatings / 70) * 100);

    const weakSubject =
      subjects.find((subject) => ratingsBySubject.get(subject.subjectId)?.some((r) => r.hasAvoidanceWarning)) ||
      subjects.find((subject) => ratingsBySubject.get(subject.subjectId)?.some((r) => r.isNeglected)) ||
      [...subjects].sort((a, b) => {
        const aRating = ratingsBySubject.get(a.subjectId)?.[0]?.selfRating || 5;
        const bRating = ratingsBySubject.get(b.subjectId)?.[0]?.selfRating || 5;
        return aRating - bRating;
      })[0];
    const weakSubjectName = weakSubject ? weakSubject.subjectName : "None";

    const subjectsStatus = ratingsList
      .map((item) => 
        `- ${item.subjectName} (Weight: ${Math.round(item.importanceLevel * 100)}%): ` +
        `Rating: ${item.latestRating ? `${item.latestRating}/5` : "Not rated"}, ` +
        `Hours studied: ${item.hoursStudied}h, ` +
        `Questions solved: ${item.questionsSolved}, ` +
        `${item.isNeglected ? "[Neglected] " : ""}${item.hasAvoidanceWarning ? "[Avoidance Warning]" : ""}`
      )
      .join("\n");

    const todayTasks = existingPlan?.tasks.length
      ? existingPlan.tasks.map((task: Task) => `- ${task.title} (${task.durationMin} mins, status: ${task.status})`).join("\n")
      : "No plan generated for today yet.";

    const recentJournalContext = recentJournals.length
      ? recentJournals.map((journal: any) =>
          `* ${journal.date.toISOString().split("T")[0]}: ` +
          `Study: ${journal.studyDone ? "Done" : "Missed"}, Exercise: ${journal.exerciseDone ? "Done" : "Missed"} | ` +
          `Entry: ${journal.entryText.slice(0, 300)}`
        ).join("\n")
      : "No journal history logged.";

    const conversation = messages
      .map((message: { role: "user" | "assistant"; content: string }) => `${message.role === "user" ? "Student" : "Coach"}: ${message.content}`)
      .join("\n");

    const prompt = loadPrompt("general_chat.md", {
      TUTOR_NAME: "Jujum AI",
      STUDENT_LEVEL: settings?.prepLevel || "Beginner",
      user_name: settings?.name || "Aspirant",
      target_exam: settings?.targetExam || "GATE",
      target_year: settings?.targetYear || 2027,
      prep_level: settings?.prepLevel || "Beginner",
      preferred_language: settings?.preferredLanguage || "hinglish",
      wake_time: settings?.wakeTime || "06:00",
      sleep_time: settings?.sleepTime || "22:00",
      overall_readiness: String(overallReadiness),
      weak_subject: weakSubjectName,
      subjects_status: subjectsStatus,
      main_priority: existingPlan?.mainPriority || "None",
      today_tasks: todayTasks,
      recent_journals: recentJournalContext,
      conversation,
    });

    const requestedProvider = isAiProviderName(req.body?.aiProvider) ? req.body.aiProvider : undefined;
    const requestedModel = typeof req.body?.aiModel === "string" && req.body.aiModel.trim().length <= 160
      ? req.body.aiModel.trim()
      : undefined;

    const aiResponse = await aiChat(
      "You are Jujum AI, a flexible, intelligent AI partner. Answer the student's LATEST message directly and naturally. Do NOT force background subjects (like Thermodynamics), exam tags, or study stats into greetings or unrelated prompts. Return valid JSON only.",
      prompt,
      { provider: requestedProvider, model: requestedModel }
    );

    const jsonStart = aiResponse.indexOf("{");
    const jsonEnd = aiResponse.lastIndexOf("}");
    if (jsonStart < 0 || jsonEnd <= jsonStart) {
      throw new Error("Coach response did not contain JSON.");
    }

    const parsed = JSON.parse(jsonrepair(aiResponse.slice(jsonStart, jsonEnd + 1))) as {
      reply?: unknown;
      suggestions?: unknown;
      action?: unknown;
      layout?: unknown;
    };

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.map((suggestion) => String(suggestion).trim().slice(0, 100)).filter(Boolean).slice(0, 4)
      : [];

    const reply = String(parsed.reply || "I am listening. How can I help you today?").trim().slice(0, 2000);
    const action = parsed.action && typeof parsed.action === "object" ? parsed.action : null;
    const validLayouts = new Set([
      "quick_answer",
      "concept_explainer",
      "problem_solving",
      "comparison",
      "study_plan",
      "revision",
      "career_guidance",
      "app_assistance",
      "general",
    ]);
    const layout = typeof parsed.layout === "string" && validLayouts.has(parsed.layout)
      ? parsed.layout
      : "general";

    res.json({
      reply,
      suggestions,
      action,
      layout,
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

// Mobile compatibility route. Keep the original web route above so older
// clients continue working, while accepting the lower-case status contract
// Mobile compatibility route for task status & duration update
app.patch("/api/routine/tasks/:taskId", async (req: Request, res: Response) => {
  const statusMap: Record<string, "COMPLETED" | "PARTIAL" | "NOT"> = {
    completed: "COMPLETED",
    partial: "PARTIAL",
    not_completed: "NOT",
  };
  const requested = typeof req.body?.status === "string" ? req.body.status.toLowerCase() : "";
  const status = statusMap[requested];
  const durationMin = typeof req.body?.durationMin === "number" ? Math.max(5, Math.min(480, Math.round(req.body.durationMin))) : undefined;

  const dataToUpdate: any = {};
  if (status) {
    dataToUpdate.status = status;
    dataToUpdate.finalizedAt = status === "NOT" ? null : new Date();
  }
  if (durationMin !== undefined) {
    dataToUpdate.durationMin = durationMin;
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return res.status(400).json({ error: "Provide a valid status or durationMin to update." });
  }

  try {
    const task = await prisma.task.update({
      where: { taskId: req.params.taskId },
      data: dataToUpdate,
    });
    res.set("Cache-Control", "no-store").json({ task });
  } catch (error: any) {
    const status = error?.code === "P2025" ? 404 : 500;
    res.status(status).json({ error: status === 404 ? "Task not found." : error.message });
  }
});

// Add a single task to today's Routine Plan
app.post("/api/routine/tasks", async (req: Request, res: Response) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) {
    return res.status(400).json({ error: "Task title is required." });
  }

  const durationMin = Math.max(5, Math.min(480, Math.round(Number(req.body?.durationMin) || 30)));
  const taskType = inferTaskType(title);
  const dateQuery = req.query.date as string || req.body?.date as string;
  const targetDate = dateQuery ? new Date(dateQuery) : getKolkataDate();

  try {
    let plan = await prisma.routinePlan.findUnique({
      where: { date: targetDate },
      include: { tasks: true },
    });

    if (!plan) {
      plan = await prisma.routinePlan.create({
        data: {
          date: targetDate,
          greeting: "Your plan is ready. Start with the first task.",
          planText: `1. ${title} (Duration: ${durationMin} mins)`,
          mainPriority: title,
          totalEstimatedMin: durationMin,
          isWeekend: targetDate.getDay() === 0 || targetDate.getDay() === 6,
        },
        include: { tasks: true },
      });
    }

    const newTask = await prisma.task.create({
      data: {
        date: targetDate,
        planId: plan.planId,
        title,
        taskType,
        durationMin,
        status: "NOT",
        isPriority: (plan.tasks?.length || 0) === 0,
      },
    });

    res.status(201).json({ success: true, task: newTask });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a single task from Routine Plan
app.delete("/api/routine/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const deletedTask = await prisma.task.delete({
      where: { taskId: req.params.taskId },
    });

    const remainingCount = await prisma.task.count({
      where: { planId: deletedTask.planId },
    });

    if (remainingCount === 0) {
      await prisma.routinePlan.delete({
        where: { planId: deletedTask.planId },
      }).catch(() => {});
    }

    res.json({ success: true, message: "Task deleted." });
  } catch (error: any) {
    const status = error?.code === "P2025" ? 404 : 500;
    res.status(status).json({ error: status === 404 ? "Task not found." : error.message });
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
    privateJournalByDateOrNull(yesterday),
    prisma.progressRating.findMany({
      orderBy: [{ weekStartDate: "desc" }],
      distinct: ["subjectId"],
    }),
    prisma.subject.findMany(),
  ]);

  const userName = settings?.name || "Aspirant";
  const availableHours = 24;
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

app.post("/api/routine/generate", async (_req: Request, res: Response) => {
  return res.status(400).json({ error: "Automatic plan generation has been removed. Please create your plan manually via the dashboard." });
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
      }

      return res.json({ job: "finalize_yesterday", status: "completed" });
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
 * Returns { data, error } â€” data is null only if ALL strategies fail.
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

  // â”€â”€ Strategy 1: Direct parse with LaTeX escape cleaning â”€â”€
  try {
    const s1 = cleanLatexEscapes(extracted);
    return { data: JSON.parse(s1), error: null };
  } catch { /* continue */ }

  // â”€â”€ Strategy 2: jsonrepair on LaTeX-cleaned string â”€â”€
  try {
    const s2 = cleanLatexEscapes(extracted);
    const repaired = jsonrepair(s2);
    return { data: JSON.parse(repaired), error: null };
  } catch { /* continue */ }

  // â”€â”€ Strategy 3: Aggressive sanitize (fix newlines, balance braces) + jsonrepair â”€â”€
  try {
    const s3 = aggressiveSanitize(cleanLatexEscapes(extracted));
    const repaired = jsonrepair(s3);
    return { data: JSON.parse(repaired), error: null };
  } catch { /* continue */ }

  // â”€â”€ Strategy 4: Raw jsonrepair on original extracted text (no LaTeX cleaning) â”€â”€
  try {
    const s4 = aggressiveSanitize(extracted);
    const repaired = jsonrepair(s4);
    return { data: JSON.parse(repaired), error: null };
  } catch { /* continue */ }

  // â”€â”€ Strategy 5: Build minimal fallback object from whatever we can extract â”€â”€
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

async function explainConcept(req: Request, res: Response) {
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

    // Fallback attempt (stricter instructions) â€” only if first attempt completely failed
    if (!parseSuccessful) {
      console.log("[AI Fallback] First attempt failed JSON parsing. Retrying with stricter instructions.");
      success = true;
      errorMessage = null;
      try {
        const fallbackPrompt = finalSystemPrompt + "\n\nCRITICAL WARNING: Your previous response was invalid JSON. You must return ONLY the raw minified JSON object matching the requested schema, starting with { and ending with }. No conversation, no markdown codeblocks, and no wrapping in ```json. Do not use literal newlines inside string values â€” use \\n instead.";
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
}

app.post("/api/explainer/query", explainConcept);
app.post("/api/explainer/explain", (req: Request, res: Response) => {
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
  const userQuery = typeof req.body?.userQuery === "string" ? req.body.userQuery.trim() : "";
  req.body = {
    ...req.body,
    topic: [subject, topic, userQuery].filter(Boolean).join(": ") || topic || userQuery,
    mode: req.body?.mode || "detailed",
  };
  return explainConcept(req, res);
});

// --- Progress Tracker (Phase 2) ---

app.post("/api/tracker/rating", async (req: Request, res: Response) => {
  const { subjectId, selfRating, hoursStudied, questionsSolved, confidenceLevel, notes } = req.body;
  
  if (!subjectId || !selfRating || selfRating < 1 || selfRating > 5) {
    return res.status(400).json({ error: "subjectId and selfRating (1-5) are required." });
  }

  try {
    const monday = getKolkataMonday();

    const existing = await prisma.progressRating.findUnique({
      where: {
        subjectId_weekStartDate: {
          subjectId: Number(subjectId),
          weekStartDate: monday,
        },
      },
    });

    const currentHours = existing?.hoursStudied || 0;
    const currentQuestions = existing?.questionsSolved || 0;
    const addHours = Number(hoursStudied || 0.0);
    const addQuestions = Number(questionsSolved || 0);

    const rating = await prisma.progressRating.upsert({
      where: {
        subjectId_weekStartDate: {
          subjectId: Number(subjectId),
          weekStartDate: monday,
        },
      },
      update: {
        selfRating: Number(selfRating),
        hoursStudied: currentHours + addHours,
        questionsSolved: currentQuestions + addQuestions,
        confidenceLevel: Number(confidenceLevel || 3),
        notes: notes ? `${existing?.notes ? existing.notes + " | " : ""}${notes}` : existing?.notes,
      },
      create: {
        subjectId: Number(subjectId),
        weekStartDate: monday,
        selfRating: Number(selfRating),
        hoursStudied: addHours,
        questionsSolved: addQuestions,
        confidenceLevel: Number(confidenceLevel || 3),
        notes: notes || null,
      },
    });

    // Mark AI analysis as stale in global settings
    await (prisma.settings as any).upsert({
      where: { id: "default" },
      update: { analysisStale: true },
      create: { id: "default", name: "GATE Aspirant", analysisStale: true }
    });

    trackerStatusCache = null;
    res.json(rating);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/subjects", async (req: Request, res: Response) => {
  const { subjectName, importanceLevel, topics } = req.body;

  if (!subjectName || typeof subjectName !== "string" || !subjectName.trim()) {
    return res.status(400).json({ error: "subjectName is required." });
  }

  try {
    const maxSubject = await prisma.subject.findFirst({
      orderBy: { subjectId: "desc" },
      select: { subjectId: true },
    });
    const nextId = (maxSubject?.subjectId || 0) + 1;
    const importance = typeof importanceLevel === "number" ? importanceLevel : 0.1;
    const topicList = Array.isArray(topics)
      ? topics
      : typeof topics === "string"
      ? topics.split(",").map((t: string) => t.trim()).filter(Boolean)
      : [];

    const newSubject = await prisma.subject.create({
      data: {
        subjectId: nextId,
        subjectName: subjectName.trim(),
        importanceLevel: importance,
        topics: topicList,
      },
    });

    trackerStatusCache = null;
    res.json(newSubject);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/subjects/:subjectId", async (req: Request, res: Response) => {
  const subjectId = parseInt(req.params.subjectId, 10);
  if (isNaN(subjectId)) {
    return res.status(400).json({ error: "Invalid subjectId" });
  }

  try {
    const subject = await prisma.subject.findUnique({
      where: { subjectId },
    });

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    await prisma.$transaction([
      (prisma as any).studyLog?.deleteMany ? (prisma as any).studyLog.deleteMany({ where: { subjectId } }) : Promise.resolve(),
      prisma.progressRating.deleteMany({ where: { subjectId } }),
      prisma.topicStatus.deleteMany({ where: { subjectId } }),
      prisma.task.updateMany({ where: { subjectId }, data: { subjectId: null } }),
      prisma.conceptExplanation.updateMany({ where: { subjectId }, data: { subjectId: null } }),
      prisma.subject.delete({ where: { subjectId } }),
    ]);


    trackerStatusCache = null;
    res.json({ success: true, message: `Subject "${subject.subjectName}" deleted successfully.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



function getKolkataDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

app.post("/api/tracker/log", async (req: Request, res: Response) => {
  const { logDate, timeBlock, subjectId, subjectName, hoursStudied, questionsSolved, notes } = req.body;

  if (!subjectId || !subjectName) {
    return res.status(400).json({ error: "subjectId and subjectName are required." });
  }

  const hours = Number(hoursStudied || 0);
  const questions = Number(questionsSolved || 0);
  const dateStr = logDate || getKolkataDateString();
  const block = timeBlock || "Evening";

  try {
    const monday = getKolkataMonday();

    // 1. Update cumulative subject progress in database
    const existing = await prisma.progressRating.findUnique({
      where: {
        subjectId_weekStartDate: {
          subjectId: Number(subjectId),
          weekStartDate: monday,
        },
      },
    });

    const currentHours = existing?.hoursStudied || 0;
    const currentQuestions = existing?.questionsSolved || 0;

    await prisma.progressRating.upsert({
      where: {
        subjectId_weekStartDate: {
          subjectId: Number(subjectId),
          weekStartDate: monday,
        },
      },
      update: {
        hoursStudied: currentHours + hours,
        questionsSolved: currentQuestions + questions,
        notes: notes ? `${existing?.notes ? existing.notes + " | " : ""}${notes}` : existing?.notes,
      },
      create: {
        subjectId: Number(subjectId),
        weekStartDate: monday,
        selfRating: 3,
        hoursStudied: hours,
        questionsSolved: questions,
        confidenceLevel: 3,
        notes: notes || null,
      },
    });

    // 2. Save directly to Prisma StudyLog (Primary Store in Postgres)
    const newStudyLog: any = await ((prisma as any).studyLog?.create ? (prisma as any).studyLog.create({
      data: {
        logDate: dateStr,
        timeBlock: block,
        subjectId: Number(subjectId),
        subjectName: String(subjectName),
        hoursStudied: hours,
        questionsSolved: questions,
        notes: notes || null,
      },
    }) : { id: `log-${Date.now()}`, createdAt: new Date() });

    // Background backup sync to Cloudflare D1 (non-blocking)
    saveStudyLogToD1({
      id: newStudyLog.id,
      logDate: dateStr,
      timeBlock: block,
      subjectId: Number(subjectId),
      subjectName: String(subjectName),
      hoursStudied: hours,
      questionsSolved: questions,
      notes: notes || null,
      createdAt: newStudyLog.createdAt instanceof Date ? newStudyLog.createdAt.getTime() : Date.now(),
    }).catch(() => {});

    trackerStatusCache = null;
    await (prisma.settings as any).updateMany({
      data: { analysisStale: true },
    }).catch(() => {});
    res.json({ success: true, logId: newStudyLog.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tracker/reset", async (req: Request, res: Response) => {
  try {
    if ((prisma as any).studyLog?.deleteMany) {
      await (prisma as any).studyLog.deleteMany({});
    }
    await clearTrackerLogsInD1().catch(() => {});
    await prisma.progressRating.deleteMany({});
    trackerStatusCache = null;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});




app.get("/api/tracker/status", async (req: Request, res: Response) => {
  try {

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

    // Group to calculate cumulative stats (single query)
    const cumulativeStats = await prisma.progressRating.groupBy({
      by: ["subjectId"],
      _sum: {
        hoursStudied: true,
        questionsSolved: true,
      },
    });
    const cumulativeMap = new Map<number, { hoursStudied: number | null, questionsSolved: number | null }>();
    for (const c of cumulativeStats) {
      cumulativeMap.set(c.subjectId, c._sum);
    }

    const now = getKolkataDate();
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

    const ratingsBySubject = new Map<number, typeof ratings>();
    for (const rating of ratings) {
      const subjectRatings = ratingsBySubject.get(rating.subjectId) || [];
      if (subjectRatings.length < 5) { // Fetch enough history to check for avoidance warning
        subjectRatings.push(rating);
        ratingsBySubject.set(rating.subjectId, subjectRatings);
      }
    }

    let totalWeightedScore = 0;
    let totalWeight = 0;

    const ratingsList = subjects.map((subject) => {
      const recentRatings = ratingsBySubject.get(subject.subjectId) || [];
      const latestRating = recentRatings[0] || null;
      
      const isNeglected = latestRating
        ? latestRating.weekStartDate < threeWeeksAgo
        : true;

      // hasAvoidanceWarning: rating <= 2 logged in 3 or more consecutive weeks in history
      const hasAvoidanceWarning = recentRatings.length >= 3 &&
        recentRatings.slice(0, 3).every((r) => r.selfRating <= 2);

      const cumulative = cumulativeMap.get(subject.subjectId);
      const cumulativeHours = cumulative?.hoursStudied || 0;
      const cumulativeQuestions = cumulative?.questionsSolved || 0;

      const ratingValue = latestRating ? latestRating.selfRating : 0;
      totalWeightedScore += (ratingValue / 5) * 100 * subject.importanceLevel;
      totalWeight += subject.importanceLevel;

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
        hasAvoidanceWarning,
        cumulativeHours,
        cumulativeQuestions,
      };
    });

    const overallReadiness = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;

    // 1. Fetch study logs directly from Prisma Postgres (Primary Store)
    const prismaLogs: any[] = await ((prisma as any).studyLog?.findMany({
      orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
      take: 300,
    }) || []);

    const logs = (prismaLogs || []).map((l: any) => ({
      id: l.id,
      logDate: l.logDate,
      timeBlock: l.timeBlock,
      subjectId: l.subjectId,
      subjectName: l.subjectName,
      hoursStudied: l.hoursStudied,
      questionsSolved: l.questionsSolved,
      notes: l.notes,
      createdAt: l.createdAt instanceof Date ? l.createdAt.getTime() : Number(l.createdAt || Date.now()),
    }));

    // 2. Compute rolling last 7-day statistics in Asia/Kolkata timezone
    const todayKolkataDateStr = getKolkataDateString();
    const nowKolkata = getKolkataDate();
    const sevenDaysAgoDate = new Date(nowKolkata);
    sevenDaysAgoDate.setDate(sevenDaysAgoDate.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgoDate.toISOString().slice(0, 10);

    const last7DayLogs = logs.filter((l) => (l.logDate || "").slice(0, 10) >= sevenDaysAgoStr);
    const total7DayHours = last7DayLogs.reduce((sum, l) => sum + (Number(l.hoursStudied) || 0), 0);
    const total7DayQuestions = last7DayLogs.reduce((sum, l) => sum + (Number(l.questionsSolved) || 0), 0);

    const subject7DayMap = new Map<number, { hours: number; questions: number; sessionCount: number }>();
    for (const l of last7DayLogs) {
      const existing = subject7DayMap.get(l.subjectId) || { hours: 0, questions: 0, sessionCount: 0 };
      existing.hours += Number(l.hoursStudied) || 0;
      existing.questions += Number(l.questionsSolved) || 0;
      existing.sessionCount += 1;
      subject7DayMap.set(l.subjectId, existing);
    }

    // Retrieve settings cache
    let settings: any = await prisma.settings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: "default", name: "GATE Aspirant" },
      });
    }

    // Check if daily analysis is stale (Daily refresh: regenerate each day, or when new logs/ratings arrive)
    const lastAnalysisDate = settings?.analysisWeekOf
      ? new Date(settings.analysisWeekOf).toISOString().slice(0, 10)
      : null;

    const isStale =
      settings?.analysisStale ||
      !settings?.weeklyAnalysis ||
      settings.weeklyAnalysis === "Unable to generate AI analysis at this time." ||
      lastAnalysisDate !== todayKolkataDateStr;

    let weeklyAnalysis = settings?.weeklyAnalysis || "";

    if (isStale) {
      try {
        let subjectsTable = "| Subject | Weight | 7-Day Hours | 7-Day Questions | Sessions (7d) | All-Time Hours | Status |\n";
        subjectsTable += "|---|---|---|---|---|---|---|\n";
        for (const r of ratingsList) {
          const s7 = subject7DayMap.get(r.subjectId) || { hours: 0, questions: 0, sessionCount: 0 };
          const status = s7.hours > 0 ? "Active this week" : r.isNeglected ? "Neglected (>21d)" : "No study this week";
          subjectsTable += `| ${r.subjectName} | ${Math.round(r.importanceLevel * 100)}% | ${s7.hours.toFixed(1)}h | ${s7.questions} | ${s7.sessionCount} | ${r.cumulativeHours.toFixed(1)}h | ${status} |\n`;
        }

        const logHistorySummary = last7DayLogs.slice(0, 10).map((l) =>
          `- ${l.logDate} (${l.timeBlock}): ${l.subjectName} — ${l.hoursStudied}h, ${l.questionsSolved} questions${l.notes ? ` ("${l.notes}")` : ""}`
        ).join("\n") || "No study sessions logged in the last 7 days.";

        const sysPrompt = loadPrompt("tracker_analysis.md", {
          user_name: settings?.name || "Aspirant",
          readiness: overallReadiness,
          subjects_table: subjectsTable,
          recent_logs: logHistorySummary,
          total_7d_hours: total7DayHours.toFixed(1),
          total_7d_questions: String(total7DayQuestions),
          daily_goal: String(settings.dailyAvailableHours || 4.0),
        });

        const aiResponse = await aiChat(
          sysPrompt,
          `Review my last 7-day study logs (${total7DayHours.toFixed(1)}h total studied across ${last7DayLogs.length} sessions, ${total7DayQuestions} questions solved) and give me daily actionable feedback for GATE CSE.`
        );

        weeklyAnalysis = aiResponse.replace(/```(?:markdown)?/gi, "").replace(/```/g, "").trim();

        // Update cached values in settings with today's date
        settings = await (prisma.settings as any).update({
          where: { id: "default" },
          data: {
            weeklyAnalysis,
            analysisWeekOf: new Date(`${todayKolkataDateStr}T00:00:00.000Z`),
            analysisStale: false,
          },
        });
      } catch (aiError) {
        console.error("Failed to generate tracker AI analysis:", aiError);
        weeklyAnalysis = settings?.weeklyAnalysis || "";
      }
    }

    const value = {
      overallReadiness,
      subjects: ratingsList,
      weeklyAnalysis,
      logs,
      dailyAvailableHours: settings.dailyAvailableHours || 4.0,
    };

    trackerStatusCache = { value, expiresAt: Date.now() + 300_000 };
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("X-Tracker-Cache", "miss");
    res.json(value);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tracker/goal", async (req: Request, res: Response) => {
  const { dailyAvailableHours } = req.body;
  const hours = Number(dailyAvailableHours);
  if (isNaN(hours) || hours <= 0 || hours > 24) {
    return res.status(400).json({ error: "dailyAvailableHours must be between 0.5 and 24." });
  }

  try {
    const updated = await prisma.settings.upsert({
      where: { id: "default" },
      update: { dailyAvailableHours: hours },
      create: { id: "default", name: "GATE Aspirant", dailyAvailableHours: hours },
    });
    trackerStatusCache = null;
    res.json({ success: true, dailyAvailableHours: updated.dailyAvailableHours });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Finance API Routes ---

function getFinanceModels() {
  const expense = (prisma as any).financeExpense || (prisma as any).FinanceExpense;
  const budget = (prisma as any).financeBudget || (prisma as any).FinanceBudget;
  const bill = (prisma as any).financeBill || (prisma as any).FinanceBill;
  return { expense, budget, bill };
}

app.get("/api/finance/data", async (_req: Request, res: Response) => {
  try {
    const { expense, budget, bill } = getFinanceModels();
    const [expenses, budgetRecord, bills] = await Promise.all([
      expense?.findMany
        ? expense.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] })
        : Promise.resolve([]),
      budget?.findUnique
        ? budget.findUnique({ where: { id: "default" } })
        : Promise.resolve(null),
      bill?.findMany
        ? bill.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] })
        : Promise.resolve([]),
    ]);

    const defaultCaps = {
      "Hostel & utilities": 0,
      "Food & mess": 0,
      "Travel & commute": 0,
      "Academics": 0,
      "Personal & health": 0,
      "Subscriptions": 0,
      "Fun & social": 0,
      "Others": 0,
    };

    res.json({
      expenses: expenses || [],
      budget: budgetRecord
        ? {
            allowance: budgetRecord.allowance,
            caps: budgetRecord.caps || defaultCaps,
          }
        : {
            allowance: 0,
            caps: defaultCaps,
          },
      bills: bills || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/finance/expense", async (req: Request, res: Response) => {
  try {
    const { id, title, category, amount, date, payment } = req.body;
    if (!title || typeof amount !== "number") {
      return res.status(400).json({ error: "title and numeric amount are required." });
    }

    const { expense } = getFinanceModels();
    if (!expense) {
      return res.json({ success: true, expense: { id: id || `exp-${Date.now()}`, title, category, amount, date, payment } });
    }

    if (id) {
      const updated = await expense.upsert({
        where: { id },
        update: {
          title: String(title).trim(),
          category: String(category || "Others"),
          amount: Number(amount),
          date: String(date || getKolkataDateString()),
          payment: String(payment || "UPI"),
        },
        create: {
          id,
          title: String(title).trim(),
          category: String(category || "Others"),
          amount: Number(amount),
          date: String(date || getKolkataDateString()),
          payment: String(payment || "UPI"),
        },
      });
      return res.json({ success: true, expense: updated });
    } else {
      const created = await expense.create({
        data: {
          title: String(title).trim(),
          category: String(category || "Others"),
          amount: Number(amount),
          date: String(date || getKolkataDateString()),
          payment: String(payment || "UPI"),
        },
      });
      return res.json({ success: true, expense: created });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/finance/expense/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Expense ID is required." });
    const { expense } = getFinanceModels();
    if (expense?.deleteMany) {
      await expense.deleteMany({ where: { id } });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/finance/expense", async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string || req.body?.id;
    if (!id) return res.status(400).json({ error: "Expense ID is required." });
    const { expense } = getFinanceModels();
    if (expense?.deleteMany) {
      await expense.deleteMany({ where: { id } });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/finance/budget", async (req: Request, res: Response) => {
  try {
    const { allowance, caps } = req.body;
    const allowanceNum = Number(allowance || 0);
    const { budget } = getFinanceModels();

    if (!budget?.upsert) {
      return res.json({ success: true, budget: { id: "default", allowance: allowanceNum, caps: caps || {} } });
    }

    const updated = await budget.upsert({
      where: { id: "default" },
      update: {
        allowance: allowanceNum,
        caps: caps || {},
      },
      create: {
        id: "default",
        allowance: allowanceNum,
        caps: caps || {},
      },
    });

    res.json({ success: true, budget: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/finance/bill", async (req: Request, res: Response) => {
  try {
    const { id, title, date, amount, category, paid } = req.body;
    if (!title || typeof amount !== "number") {
      return res.status(400).json({ error: "title and numeric amount are required." });
    }

    const { bill } = getFinanceModels();
    if (!bill) {
      return res.json({ success: true, bill: { id: id || `bill-${Date.now()}`, title, date, amount, category, paid: Boolean(paid) } });
    }

    if (id) {
      const updated = await bill.upsert({
        where: { id },
        update: {
          title: String(title).trim(),
          date: String(date || getKolkataDateString()),
          amount: Number(amount),
          category: String(category || "Subscriptions"),
          paid: Boolean(paid),
        },
        create: {
          id,
          title: String(title).trim(),
          date: String(date || getKolkataDateString()),
          amount: Number(amount),
          category: String(category || "Subscriptions"),
          paid: Boolean(paid),
        },
      });
      return res.json({ success: true, bill: updated });
    } else {
      const created = await bill.create({
        data: {
          title: String(title).trim(),
          date: String(date || getKolkataDateString()),
          amount: Number(amount),
          category: String(category || "Subscriptions"),
          paid: Boolean(paid),
        },
      });
      return res.json({ success: true, bill: created });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/finance/bill/pay", async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: "Bill ID is required." });

    const { bill, expense } = getFinanceModels();
    if (!bill || !expense) {
      return res.json({ success: true });
    }

    let targetBill = await bill.findUnique({
      where: { id },
    });

    if (!targetBill) {
      targetBill = await bill.findFirst({
        where: { OR: [{ id }, { paid: false }] },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!targetBill) return res.status(404).json({ error: "Bill not found." });

    const updatedBill = await bill.update({
      where: { id: targetBill.id },
      data: { paid: true },
    });

    const expenseId = `bill-${targetBill.id}`;
    const todayDate = getKolkataDateString();

    let createdExpense = null;
    try {
      createdExpense = await expense.upsert({
        where: { id: expenseId },
        update: {
          title: targetBill.title,
          category: targetBill.category,
          amount: targetBill.amount,
          date: todayDate,
          payment: "UPI",
        },
        create: {
          id: expenseId,
          title: targetBill.title,
          category: targetBill.category,
          amount: targetBill.amount,
          date: todayDate,
          payment: "UPI",
        },
      });
    } catch {
      createdExpense = await expense.create({
        data: {
          title: targetBill.title,
          category: targetBill.category,
          amount: targetBill.amount,
          date: todayDate,
          payment: "UPI",
        },
      });
    }

    res.json({ success: true, bill: updatedBill, expense: createdExpense });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/finance/bill/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Bill ID is required." });
    const { bill } = getFinanceModels();
    if (bill?.deleteMany) {
      await bill.deleteMany({ where: { id } });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/finance/bill", async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string || req.body?.id;
    if (!id) return res.status(400).json({ error: "Bill ID is required." });
    const { bill } = getFinanceModels();
    if (bill?.deleteMany) {
      await bill.deleteMany({ where: { id } });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/finance/reset", async (_req: Request, res: Response) => {
  try {
    const { expense, budget, bill } = getFinanceModels();
    if (expense?.deleteMany) await expense.deleteMany({});
    if (bill?.deleteMany) await bill.deleteMany({});
    if (budget?.deleteMany) await budget.deleteMany({});
    res.json({ success: true, message: "Finance data reset successfully." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/finance/bill/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Bill ID is required." });
    await (prisma as any).financeBill.deleteMany({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/finance/bill", async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string || req.body?.id;
    if (!id) return res.status(400).json({ error: "Bill ID is required." });
    await (prisma as any).financeBill.deleteMany({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/finance/reset", async (_req: Request, res: Response) => {
  try {
    await (prisma as any).financeExpense.deleteMany({});
    await (prisma as any).financeBill.deleteMany({});
    await (prisma as any).financeBudget.deleteMany({});
    res.json({ success: true, message: "Finance data reset successfully in Supabase." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Server Listen ---

app.listen(PORT, () => {
  console.log(`Backend server successfully running on port ${PORT}`);
});

