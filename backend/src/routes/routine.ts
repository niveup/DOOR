import type { Express, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { jsonrepair } from "jsonrepair";
import type { AiProviderName } from "../lib/ai/provider";
import { getKolkataDate } from "../lib/time";

/**
 * Routine + tasks domain routes, extracted from server.ts (audit GA-114 step 3).
 * Behavior is identical to the inline version: same paths, same validation,
 * same AI spend guards, same confirm-free task mutations.
 *
 * Shared AI orchestration (spend guard, prompt loading, provider selection,
 * chat dispatch) stays in server.ts and is injected, so journal and explainer
 * keep using the single implementation.
 */
export interface RoutineDeps {
  allowAiSpend(req: Request, res: Response): boolean;
  loadPrompt(filename: string, variables?: Record<string, any>): string;
  isAiProviderName(value: unknown): value is AiProviderName;
  aiChat(
    systemPrompt: string,
    userPrompt: string,
    options?: { provider?: AiProviderName; model?: string; imageUrl?: string }
  ): Promise<string>;
}

export function registerRoutineRoutes(app: Express, prisma: PrismaClient, deps: RoutineDeps): void {
  const { allowAiSpend, loadPrompt, isAiProviderName, aiChat } = deps;

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
    if (!allowAiSpend(req, res)) return;
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
        userDraftTaskCount: rawDraftTasks.length,
      });

      const prompt = loadPrompt("plan_chat.md", {
        user_name: "Aspirant",
        current_draft_tasks: currentDraftText,
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
    if (!allowAiSpend(req, res)) return;
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
      const conversation = messages
        .map((message: { role: "user" | "assistant"; content: string }) => `${message.role === "user" ? "Student" : "Coach"}: ${message.content}`)
        .join("\n");

      const prompt = loadPrompt("general_chat.md", {
        TUTOR_NAME: "Jujum AI",
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
    const rawTitle = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const title = rawTitle.length >= 2 && rawTitle.length <= 180 ? rawTitle : undefined;

    const dataToUpdate: any = {};
    if (status) {
      dataToUpdate.status = status;
      dataToUpdate.finalizedAt = status === "NOT" ? null : new Date();
    }
    if (durationMin !== undefined) {
      dataToUpdate.durationMin = durationMin;
    }
    if (title !== undefined) {
      dataToUpdate.title = title;
      dataToUpdate.taskType = inferTaskType(title);
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return res.status(400).json({ error: "Provide a valid status, durationMin or title to update." });
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

  app.post("/api/routine/generate", async (_req: Request, res: Response) => {
    return res.status(400).json({ error: "Automatic plan generation has been removed. Please create your plan manually via the dashboard." });
  });
}

function inferTaskType(title: string): "study" | "exercise" | "reading" | "routine" {
  const normalized = title.toLowerCase();
  if (/(exercise|workout|walk|run|stretch|gym)/.test(normalized)) return "exercise";
  if (/(read|book|article)/.test(normalized)) return "reading";
  if (/(routine|meditat|sleep|wake|plan|journal)/.test(normalized)) return "routine";
  return "study";
}

export async function generateTodayRoutinePlan(
  prisma: PrismaClient,
  deps: Pick<RoutineDeps, "loadPrompt" | "aiChat">,
  replaceExisting: boolean
) {
  const { loadPrompt, aiChat } = deps;
  const today = getKolkataDate();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const existingPlan = await prisma.routinePlan.findUnique({ where: { date: today } });

  if (existingPlan && !replaceExisting) {
    return { job: "generate_plan", status: "skipped_already_exists", planId: existingPlan.planId };
  }

  const userName = "Aspirant";
  const availableHours = 24;
  const tomorrowTask = "Study GATE Syllabus Core Topics";
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const systemPrompt = loadPrompt("routine_plan.md", {
    user_name: userName,
    date: today.toISOString().split("T")[0],
    streak_count: 5,
    tomorrow_task: tomorrowTask,
    available_hours: availableHours,
    available_minutes: availableHours * 60,
    max_minutes: Math.round(availableHours * 60 * 1.1),
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
