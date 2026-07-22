import { NextRequest, NextResponse } from "next/server";
import { appPasscode, backendApiUrl } from "@/lib/env";
import { getSession } from "@/lib/session";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 110_000;
const FORWARDED_RESPONSE_HEADERS = ["content-type", "cache-control", "etag", "last-modified"] as const;
type RouteContext = { params: Promise<{ path: string[] }> };

function getKolkataMonday(date: Date = new Date()): Date {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = formatter.format(date);
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diffToMon = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diffToMon);
  return d;
}

function getKolkataDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

async function handleNativeTrackerRoute(safePath: string, method: string, parsedBody: any, reqUrl: URL) {
  // 1. GET /api/tracker/status
  if (safePath === "api/tracker/status" && method === "GET") {
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

    const cumulativeStats = await prisma.progressRating.groupBy({
      by: ["subjectId"],
      _sum: { hoursStudied: true, questionsSolved: true },
    });
    const cumulativeMap = new Map<number, { hoursStudied: number | null; questionsSolved: number | null }>();
    for (const c of cumulativeStats) {
      cumulativeMap.set(c.subjectId, c._sum);
    }

    const now = new Date();
    const threeWeeksAgo = new Date(now);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

    const ratingsBySubject = new Map<number, typeof ratings>();
    for (const rating of ratings) {
      const subjectRatings = ratingsBySubject.get(rating.subjectId) || [];
      if (subjectRatings.length < 5) {
        subjectRatings.push(rating);
        ratingsBySubject.set(rating.subjectId, subjectRatings);
      }
    }

    let totalWeightedScore = 0;
    let totalWeight = 0;

    const ratingsList = subjects.map((subject: any) => {
      const recentRatings = ratingsBySubject.get(subject.subjectId) || [];
      const latestRating = recentRatings[0] || null;
      const isNeglected = latestRating ? latestRating.weekStartDate < threeWeeksAgo : true;
      const hasAvoidanceWarning = recentRatings.length >= 3 && recentRatings.slice(0, 3).every((r: any) => r.selfRating <= 2);

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

    let settings = await prisma.settings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { id: "default", name: "GATE Aspirant" } });
    }

    const prismaLogs = await prisma.studyLog.findMany({
      orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
      take: 300,
    });

    const logs = prismaLogs.map((l: any) => ({
      id: l.id,
      logDate: l.logDate,
      timeBlock: l.timeBlock,
      subjectId: l.subjectId,
      subjectName: l.subjectName,
      hoursStudied: l.hoursStudied,
      questionsSolved: l.questionsSolved,
      notes: l.notes,
      createdAt: l.createdAt.getTime(),
    }));

    return NextResponse.json(
      {
        overallReadiness,
        subjects: ratingsList,
        weeklyAnalysis: settings.weeklyAnalysis || "",
        logs,
        dailyAvailableHours: settings.dailyAvailableHours || 4.0,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  }

  // 2. POST /api/tracker/log
  if (safePath === "api/tracker/log" && method === "POST") {
    const { logDate, timeBlock, subjectId, subjectName, hoursStudied, questionsSolved, notes } = parsedBody;
    if (!subjectId || !subjectName) {
      return NextResponse.json({ error: "subjectId and subjectName are required." }, { status: 400 });
    }

    const hours = Number(hoursStudied || 0);
    const questions = Number(questionsSolved || 0);
    const dateStr = logDate || getKolkataDateString();
    const block = timeBlock || "Evening";
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

    const newStudyLog = await prisma.studyLog.create({
      data: {
        logDate: dateStr,
        timeBlock: block,
        subjectId: Number(subjectId),
        subjectName: String(subjectName),
        hoursStudied: hours,
        questionsSolved: questions,
        notes: notes || null,
      },
    });

    return NextResponse.json({ success: true, logId: newStudyLog.id });
  }

  // 3. POST /api/tracker/goal
  if (safePath === "api/tracker/goal" && method === "POST") {
    const hours = Number(parsedBody.dailyAvailableHours);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      return NextResponse.json({ error: "dailyAvailableHours must be between 0.5 and 24." }, { status: 400 });
    }

    const updated = await prisma.settings.upsert({
      where: { id: "default" },
      update: { dailyAvailableHours: hours },
      create: { id: "default", name: "GATE Aspirant", dailyAvailableHours: hours },
    });

    return NextResponse.json({ success: true, dailyAvailableHours: updated.dailyAvailableHours });
  }

  // 4. POST /api/tracker/reset
  if (safePath === "api/tracker/reset" && method === "POST") {
    await prisma.studyLog.deleteMany({});
    await prisma.progressRating.deleteMany({});
    return NextResponse.json({ success: true });
  }

  // 5. POST /api/subjects
  if (safePath === "api/subjects" && method === "POST") {
    const { subjectName, importanceLevel, topics } = parsedBody;
    if (!subjectName || typeof subjectName !== "string" || !subjectName.trim()) {
      return NextResponse.json({ error: "subjectName is required." }, { status: 400 });
    }

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

    return NextResponse.json(newSubject);
  }

  // 6. DELETE /api/subjects/:subjectId
  if (safePath.startsWith("api/subjects/") && method === "DELETE") {
    const subjectIdStr = safePath.replace("api/subjects/", "");
    const subjectId = parseInt(subjectIdStr, 10);
    if (!isNaN(subjectId)) {
      const subject = await prisma.subject.findUnique({ where: { subjectId } });
      if (subject) {
        await prisma.$transaction([
          prisma.studyLog.deleteMany({ where: { subjectId } }),
          prisma.progressRating.deleteMany({ where: { subjectId } }),
          prisma.topicStatus.deleteMany({ where: { subjectId } }),
          prisma.task.updateMany({ where: { subjectId }, data: { subjectId: null } }),
          prisma.conceptExplanation.updateMany({ where: { subjectId }, data: { subjectId: null } }),
          prisma.subject.delete({ where: { subjectId } }),
        ]);
        return NextResponse.json({ success: true, message: `Subject "${subject.subjectName}" deleted successfully.` });
      }
    }
  }

  return null;
}

async function relay(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await context.params;
  if (path[0] === "api" && path[1] === "journal") {
    return NextResponse.json({ error: "Use the private journal route." }, {
      status: 404,
      headers: { "Cache-Control": "no-store, private, max-age=0" },
    });
  }

  const safePath = path.map(encodeURIComponent).join("/");
  let parsedBody: any = null;

  if (!["GET", "HEAD"].includes(request.method)) {
    try {
      const cloned = request.clone();
      parsedBody = await cloned.json();
    } catch {}
  }

  // Try direct native Prisma database execution first for 100% reliable cloud sync
  try {
    const nativeRes = await handleNativeTrackerRoute(safePath, request.method, parsedBody, request.nextUrl);
    if (nativeRes) return nativeRes;
  } catch (nativeErr: any) {
    console.error("Native Prisma execution warning:", nativeErr?.message || nativeErr);
  }

  // Fallback to relay proxy for external AI/Cron services
  let baseUrl: string;
  let passcode: string;
  try {
    baseUrl = backendApiUrl();
    passcode = appPasscode();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: "Backend relay is not configured.", details: message }, { status: 503 });
  }

  const target = new URL(`${baseUrl}/${safePath}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });

  const headers = new Headers({ accept: "application/json", "x-passcode": passcode });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let body: ArrayBuffer | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, { method: request.method, headers, body, cache: "no-store", redirect: "manual", signal: controller.signal });
    const responseHeaders = new Headers({ "x-content-type-options": "nosniff" });
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    const errMessage = error instanceof Error ? error.message : "network error";
    return NextResponse.json({ error: timedOut ? "Backend request timed out." : "Backend is unavailable.", details: errMessage }, { status: timedOut ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}

export const GET = relay;
export const POST = relay;
export const PUT = relay;
export const PATCH = relay;
export const DELETE = relay;
