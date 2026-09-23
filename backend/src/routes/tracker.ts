import type { Express, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { saveStudyLogToD1, clearTrackerLogsInD1 } from "../lib/private-tracker-store";
import { getKolkataDate, getKolkataMonday, getKolkataDateString } from "../lib/time";

/**
 * Tracker + subjects domain routes, extracted from server.ts (audit GA-114 step 2).
 * Behavior is identical to the inline version: same paths, same validation,
 * same confirm guard on reset, same deterministic weekly analysis.
 */
export function registerTrackerRoutes(app: Express, prisma: PrismaClient): void {
  let trackerStatusCache: { expiresAt: number; value: any } | null = null;

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
        prisma.subject.delete({ where: { subjectId } }),
      ]);


      trackerStatusCache = null;
      res.json({ success: true, message: `Subject "${subject.subjectName}" deleted successfully.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });




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

      await prisma.progressRating.upsert({
        where: {
          subjectId_weekStartDate: {
            subjectId: Number(subjectId),
            weekStartDate: monday,
          },
        },
        update: {
          hoursStudied: { increment: hours },
          questionsSolved: { increment: questions },
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
    if (req.body?.confirm !== "DELETE") {
      return res.status(400).json({ error: "This wipes the data permanently. Send { \"confirm\": \"DELETE\" } to confirm." });
    }
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

      // Generate deterministic analysis without passing database study logs to external AI
      const weakList = ratingsList.filter(r => (r.latestRating !== null && r.latestRating <= 2) || r.hasAvoidanceWarning).map(r => r.subjectName);
      const strongList = ratingsList.filter(r => (r.latestRating !== null && r.latestRating >= 4)).map(r => r.subjectName);
      const neglectedList = ratingsList.filter(r => r.isNeglected).map(r => r.subjectName);

      let weeklyAnalysis = `### 1. Weak Subjects\n${weakList.length ? weakList.join(", ") + " need focused practice." : "No critical weak subjects flagged."}\n\n`;
      weeklyAnalysis += `### 2. Strong Subjects\n${strongList.length ? strongList.join(", ") + " are currently your highest rated areas." : "Keep building consistency across subjects."}\n\n`;
      weeklyAnalysis += `### 3. Neglected Subjects\n${neglectedList.length ? neglectedList.join(", ") + " have not been logged in over 3 weeks." : "All subjects are being actively revised."}\n\n`;
      weeklyAnalysis += `### 4. Recommended Next Topics\nFocus next study blocks on ${weakList[0] || neglectedList[0] || "core formula derivations and numerical problem sets"}.\n\n`;
      weeklyAnalysis += `### 5. Daily Study Plan\nTarget ${settings?.dailyAvailableHours || 4.0} hours daily divided into 45-minute focus intervals.\n\n`;
      weeklyAnalysis += `### 6. Readiness & Velocity Reflection\nOverall syllabus readiness is ${overallReadiness}% with ${total7DayHours.toFixed(1)}h logged in the last 7 days.\n\n`;
      weeklyAnalysis += `### 7. Avoidance Warnings\n${weakList.length > 2 ? "High concentration of low ratings detected. Prioritize one weak area today." : "No avoidance warnings active. Consistency maintains momentum."}`;

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
}
