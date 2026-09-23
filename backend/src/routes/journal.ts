import fs from "fs";
import path from "path";
import type { Express, Request, Response, NextFunction } from "express";
import type { PrismaClient } from "@prisma/client";
import { decryptApiKey, encryptApiKey } from "../lib/ai/credentials";
import {
  initializeAiCredentials,
  environmentApiKey,
  environmentModel,
  resolveAiConfiguration,
  isAiProviderName,
} from "../lib/ai/boot";
import type { AiProviderName } from "../lib/ai/provider";
import {
  listPrivateJournalEntries,
  privateJournalByDate,
  savePrivateJournalEntry,
} from "../lib/private-journal-store";
import { getKolkataDate, getKolkataDateString } from "../lib/time";

/**
 * Journal + settings + AI-configuration domain routes, extracted from
 * server.ts (audit GA-114 step 4). Behavior is identical to the inline
 * version: same paths, same validation, same spend guards, same retired
 * legacy endpoint posture.
 *
 * Shared AI orchestration (spend guard, prompt loading, chat dispatch) stays
 * in server.ts and is injected, so explainer keeps using the single
 * implementation.
 */
export interface JournalDeps {
  allowAiSpend(req: Request, res: Response): boolean;
  loadPrompt(filename: string, variables?: Record<string, any>): string;
  aiChat(
    systemPrompt: string,
    userPrompt: string,
    options?: { provider?: AiProviderName; model?: string; imageUrl?: string }
  ): Promise<string>;
}

export async function publicAiConfiguration(prisma: PrismaClient) {
  await initializeAiCredentials(prisma);
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

export function registerJournalRoutes(app: Express, prisma: PrismaClient, deps: JournalDeps): void {
  const { allowAiSpend, loadPrompt, aiChat } = deps;

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
    if (!allowAiSpend(req, res)) return;
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    const mood = typeof req.body?.mood === "string" ? req.body.mood.slice(0, 20) : null;
    const tags = Array.isArray(req.body?.tags)
      ? req.body.tags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.length <= 40).slice(0, 6)
      : [];
    const date = typeof req.body?.date === "string" ? req.body.date : getKolkataDateString();
    const studyDone = req.body?.studyDone === true;
    const exerciseDone = req.body?.exerciseDone === true;
    const readingDone = req.body?.readingDone === true;
    if (content.length < 20 || content.length > 5000 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).set("Cache-Control", "no-store").json({ error: "Journal content must be 20–5000 characters and date must be YYYY-MM-DD." });
    }

    try {
      const prompt = loadPrompt("journal.md", {
        user_name: "Aspirant",
        date,
        entry_text: content,
        mood: mood || "N/A",
        tags: JSON.stringify(tags),
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
        studyDone,
        exerciseDone,
        readingDone,
      });
      res.set("Cache-Control", "no-store, private").json({ entry, feedback, tomorrowTask: entry.tomorrowTask });
    } catch (error: any) {
      console.error("Private mobile journal failed", error instanceof Error ? error.message : "unknown error");
      res.status(502).set("Cache-Control", "no-store").json({ error: "Your journal could not be saved securely right now." });
    }
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
      const {
        name,
        dailyAvailableHours,
        wakeTime,
        sleepTime,
        scoreWeights,
        targetExam,
        targetYear,
        preferredLanguage,
        prepLevel,
        exerciseGoal,
        otherGoals,
      } = req.body;

      const dataToUpdate: Record<string, any> = {};
      if (name !== undefined) dataToUpdate.name = String(name);
      if (dailyAvailableHours !== undefined) dataToUpdate.dailyAvailableHours = Number(dailyAvailableHours);
      if (wakeTime !== undefined) dataToUpdate.wakeTime = String(wakeTime);
      if (sleepTime !== undefined) dataToUpdate.sleepTime = String(sleepTime);
      if (scoreWeights !== undefined) dataToUpdate.scoreWeights = scoreWeights;
      if (targetExam !== undefined) dataToUpdate.targetExam = String(targetExam);
      if (targetYear !== undefined) dataToUpdate.targetYear = Number(targetYear);
      if (preferredLanguage !== undefined) dataToUpdate.preferredLanguage = String(preferredLanguage);
      if (prepLevel !== undefined) dataToUpdate.prepLevel = String(prepLevel);
      if (exerciseGoal !== undefined) dataToUpdate.exerciseGoal = exerciseGoal ? String(exerciseGoal) : null;
      if (otherGoals !== undefined) dataToUpdate.otherGoals = otherGoals;

      const settings = await prisma.settings.upsert({
        where: { id: "default" },
        update: dataToUpdate,
        create: {
          id: "default",
          name: name ? String(name) : "GATE Aspirant",
          targetExam: targetExam ? String(targetExam) : "GATE",
          targetYear: targetYear ? Number(targetYear) : 2026,
          dailyAvailableHours: dailyAvailableHours !== undefined ? Number(dailyAvailableHours) : 4.0,
          preferredLanguage: preferredLanguage ? String(preferredLanguage) : "hinglish",
          timezone: "Asia/Kolkata",
          wakeTime: wakeTime ? String(wakeTime) : "06:00",
          sleepTime: sleepTime ? String(sleepTime) : "22:00",
          exerciseGoal: exerciseGoal ? String(exerciseGoal) : null,
          otherGoals: otherGoals ?? null,
          prepLevel: prepLevel ? String(prepLevel) : "Beginner",
          scoreWeights: scoreWeights ?? null,
        },
      });
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/ai/config", async (_req: Request, res: Response) => {
    try {
      res.json(await publicAiConfiguration(prisma));
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
      await initializeAiCredentials(prisma);
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

      res.json(await publicAiConfiguration(prisma));
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
      const configuration = await resolveAiConfiguration(prisma, provider);
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
    if (!allowAiSpend(req, res)) return;
    const provider = req.body?.provider;
    if (!isAiProviderName(provider)) {
      return res.status(400).json({ error: "Choose OpenRouter, NVIDIA, or Cerebras." });
    }

    const startedAt = Date.now();
    try {
      const configuration = await resolveAiConfiguration(prisma, provider);
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

      // 2. Assemble prompt and call AI directly without passing DB history
      const systemPrompt = loadPrompt("journal.md", {
        user_name: "Aspirant",
        date: today.toISOString().split("T")[0],
        entry_text: entryText,
        mood: mood || "N/A",
        tags: JSON.stringify(tags || []),
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
    if (!allowAiSpend(req, res)) return;
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
      const systemPrompt = loadPrompt("journal.md", {
        user_name: "Aspirant",
        date: getKolkataDate().toISOString().split("T")[0],
        entry_text: entryText,
        mood,
        tags: JSON.stringify(tags),
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
}
