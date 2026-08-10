"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEMO_DEFAULTS, DEMO_AI_RESPONSE, createDemoStream } from "./demoData";

interface DemoContextValue {
  isDemoMode: boolean;
  exitDemoMode: () => void;
}

const DemoContext = createContext<DemoContextValue>({
  isDemoMode: false,
  exitDemoMode: () => {},
});

export function useDemoMode() {
  return useContext(DemoContext);
}

/* ── localStorage helper keyed by API path ── */
const DEMO_STORAGE_PREFIX = "jujum-demo:";

function getDemoData(path: string): unknown {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_PREFIX + path);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function setDemoData(path: string, data: unknown) {
  try {
    localStorage.setItem(DEMO_STORAGE_PREFIX + path, JSON.stringify(data));
  } catch {}
}

function clearAllDemoData() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DEMO_STORAGE_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  localStorage.removeItem("jujum-demo-mode");
}

/**
 * Normalize a fetch URL into just the API path portion.
 * e.g. "/api/backend/api/routine/today?date=2025-01-01" → "api/routine/today"
 */
function extractApiPath(url: string): string {
  let path = url;
  // Remove origin if present
  try {
    const u = new URL(url, "http://localhost");
    path = u.pathname;
  } catch {}
  // Strip /api/backend/ prefix
  path = path.replace(/^\/api\/backend\//, "");
  // Strip leading slash
  path = path.replace(/^\//, "");
  // Remove query string
  path = path.split("?")[0];
  return path;
}

/** Check if a path is for a streaming/chat endpoint */
function isStreamingEndpoint(path: string): boolean {
  return (
    path.includes("general-chat") ||
    path.includes("plan-chat") ||
    path.includes("explain") ||
    path.includes("interview/answer") ||
    path.includes("sandbox")
  );
}

/**
 * Create a fake Response that mimics what the backend would return.
 */
function createDemoResponse(
  apiPath: string,
  method: string,
  body?: unknown
): Response {
  // Streaming endpoints get a ReadableStream response
  if (method === "POST" && isStreamingEndpoint(apiPath)) {
    const stream = createDemoStream(
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: string }).message)
        : ""
    );
    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      },
    });
  }

  // Special handling for POST api/journal
  if (method === "POST" && apiPath === "api/journal") {
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, any>;
    const newEntry = {
      journalId: "demo-" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      entryText: b.entryText || "",
      mood: b.mood || "3",
      tags: Array.isArray(b.tags) ? b.tags : [],
      aiFeedback: "Demo Feedback: Great job keeping your journal updated today!",
      tomorrowTask: "Continue following your study plan.",
      patternDetected: null,
      studyDone: Boolean(b.studyDone),
      exerciseDone: Boolean(b.exerciseDone),
      readingDone: Boolean(b.readingDone),
    };
    const stored = (getDemoData("api/journal") as { entries?: any[] }) || (DEMO_DEFAULTS["api/journal"] as { entries?: any[] });
    const updatedEntries = [newEntry, ...(stored?.entries || [])];
    setDemoData("api/journal", { entries: updatedEntries });
    return new Response(JSON.stringify({ success: true, journal: newEntry }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // Special handling for POST api/subjects (Create Subject)
  if (method === "POST" && apiPath === "api/subjects") {
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, any>;
    const storedStatus = (getDemoData("api/tracker/status") as { subjects?: any[]; ratings?: any[] }) || (DEMO_DEFAULTS["api/tracker/status"] as any);
    const existingSubjects = storedStatus?.subjects || [];
    const newSubject = {
      subjectId: Date.now(),
      subjectName: b.subjectName || "New Subject",
      importanceLevel: Number(b.importanceLevel) || 3,
      topics: Array.isArray(b.topics) ? b.topics : [],
      hoursStudied: 0,
      questionsSolved: 0,
      cumulativeHours: 0,
      cumulativeQuestions: 0,
    };
    const updatedStatus = { ...storedStatus, subjects: [...existingSubjects, newSubject] };
    setDemoData("api/tracker/status", updatedStatus);
    return new Response(JSON.stringify({ success: true, subject: newSubject }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // Special handling for DELETE api/subjects/:id
  if (method === "DELETE" && apiPath.startsWith("api/subjects/")) {
    const targetId = Number(apiPath.split("/").pop());
    const storedStatus = (getDemoData("api/tracker/status") as { subjects?: any[]; ratings?: any[] }) || (DEMO_DEFAULTS["api/tracker/status"] as any);
    const updatedSubjects = (storedStatus?.subjects || []).filter((s: any) => s.subjectId !== targetId);
    setDemoData("api/tracker/status", { ...storedStatus, subjects: updatedSubjects });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // Special handling for POST api/tracker/log (Log Hours/Questions)
  if (method === "POST" && apiPath === "api/tracker/log") {
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, any>;
    const storedStatus = (getDemoData("api/tracker/status") as { subjects?: any[]; ratings?: any[] }) || (DEMO_DEFAULTS["api/tracker/status"] as any);
    const targetSubId = Number(b.subjectId);
    const addedHours = Number(b.hoursStudied) || 0;
    const addedQ = Number(b.questionsSolved) || 0;
    const updatedSubjects = (storedStatus?.subjects || []).map((s: any) => {
      if (s.subjectId === targetSubId) {
        return {
          ...s,
          hoursStudied: (s.hoursStudied || 0) + addedHours,
          questionsSolved: (s.questionsSolved || 0) + addedQ,
          cumulativeHours: (s.cumulativeHours || 0) + addedHours,
          cumulativeQuestions: (s.cumulativeQuestions || 0) + addedQ,
        };
      }
      return s;
    });
    setDemoData("api/tracker/status", { ...storedStatus, subjects: updatedSubjects });
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // For write methods, store data locally and return success
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    if (body !== undefined) {
      setDemoData(apiPath, body);
    }
    return new Response(
      JSON.stringify({ success: true, ...(typeof body === "object" ? body : {}) }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  }

  // For DELETE, remove from localStorage
  if (method === "DELETE") {
    try {
      localStorage.removeItem(DEMO_STORAGE_PREFIX + apiPath);
    } catch {}
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  // GET: return localStorage data → fallback to defaults → empty
  let stored = getDemoData(apiPath) as any;
  if (apiPath === "api/tracker/status" && (!stored || !Array.isArray(stored.subjects) || stored.subjects.length === 0)) {
    stored = DEMO_DEFAULTS["api/tracker/status"];
    setDemoData("api/tracker/status", stored);
  }
  if (apiPath === "api/tracker/subjects" && (!stored || !Array.isArray(stored) || stored.length === 0)) {
    stored = DEMO_DEFAULTS["api/tracker/subjects"];
    setDemoData("api/tracker/subjects", stored);
  }
  if (apiPath === "api/routine/today" && (!stored || !stored.plan)) {
    stored = DEMO_DEFAULTS["api/routine/today"];
    setDemoData("api/routine/today", stored);
  }
  const data = stored ?? DEMO_DEFAULTS[apiPath] ?? {};
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    setIsDemoMode(localStorage.getItem("jujum-demo-mode") === "true");
  }, []);

  const exitDemoMode = useCallback(() => {
    clearAllDemoData();
    // Remove the demo cookies
    document.cookie = "jujum_demo=; path=/; max-age=0";
    document.cookie = "jujum_demo_journal_unlocked=; path=/; max-age=0";
    setIsDemoMode(false);
    window.location.href = "/passcode";
  }, []);

  const value = useMemo(
    () => ({ isDemoMode, exitDemoMode }),
    [isDemoMode, exitDemoMode]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/**
 * Drop-in fetch wrapper. In demo mode, intercepts API calls and
 * returns data from localStorage / defaults. In normal mode, passes
 * through to the native fetch.
 */
export function useDemoFetch() {
  const { isDemoMode } = useDemoMode();

  return useCallback(
    async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      if (!isDemoMode) {
        return fetch(input, init);
      }

      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || "GET").toUpperCase();
      const apiPath = extractApiPath(url);

      // Parse body if present
      let parsedBody: unknown;
      if (init?.body) {
        try {
          parsedBody = JSON.parse(typeof init.body === "string" ? init.body : new TextDecoder().decode(init.body as ArrayBuffer));
        } catch {
          parsedBody = init.body;
        }
      }

      // Small artificial delay to feel realistic
      await new Promise((r) => setTimeout(r, 100 + Math.random() * 200));

      return createDemoResponse(apiPath, method, parsedBody);
    },
    [isDemoMode]
  );
}
