"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import { AppShell, PageSection } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { AnimatedNumber, EmptyState, MicroInteractionButton, ProgressBar } from "@/components/MotionComponents";

interface Subject {
  subjectId: number;
  subjectName: string;
  importanceLevel: number;
  topics: string[];
  hoursStudied: number;
  questionsSolved: number;
  cumulativeHours?: number;
  cumulativeQuestions?: number;
}

interface TrackerData {
  subjects: Subject[];
  weeklyAnalysis?: string | null;
  dailyAvailableHours?: number;
  logs?: Array<{
    id: string;
    logDate: string;
    timeBlock: string;
    subjectId: number;
    subjectName: string;
    hoursStudied: number;
    questionsSolved: number;
    notes: string | null;
  }>;
}

interface DailyLogEntry {
  dateStr: string;
  dayLabel: string;
  hours: number;
  questions: number;
  isToday: boolean;
}

type TimeRange = "7d" | "14d" | "30d" | "all";
type Filter = "all" | "high" | "recent" | "active";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All Subjects" },
  { id: "high", label: "High Weightage" },
  { id: "recent", label: "Recent Study" },
  { id: "active", label: "Active Practice" },
];

const timeBlocks = [
  { id: "Morning", label: "Morning" },
  { id: "Afternoon", label: "Afternoon" },
  { id: "Evening", label: "Evening" },
  { id: "Night", label: "Night" },
];

const cacheKey = "door_study_tracker_data_v2";
const logsCacheKey = "door_study_logs_history_v1";

function MetricIcon({ type }: { type: "time" | "effort" | "avg" | "questions" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (type === "time")
    return (
      <svg {...common} className="text-[var(--accent)]">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10M6 10h10" />
      </svg>
    );
  if (type === "effort")
    return (
      <svg {...common} className="text-[var(--accent)]">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    );
  if (type === "avg")
    return (
      <svg {...common} className="text-[var(--accent)]">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    );
  if (type === "questions")
    return (
      <svg {...common} className="text-[var(--accent)]">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  return null;
}

function TimeBlockIcon({ block }: { block: string }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (block === "Morning")
    return (
      <svg {...common} className="text-amber-500">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
      </svg>
    );
  if (block === "Afternoon")
    return (
      <svg {...common} className="text-orange-400">
        <path d="M12 2v2M4.93 4.93l1.41 1.41M2 12h2M20 12h2M19.07 4.93l-1.41 1.41" />
        <path d="M17 18a5 5 0 0 0-10 0" />
      </svg>
    );
  if (block === "Evening")
    return (
      <svg {...common} className="text-amber-600">
        <path d="M17 18a5 5 0 0 0-10 0" />
        <line x1="2" y1="20" x2="22" y2="20" />
        <polyline points="8 6 12 2 16 6" />
        <line x1="12" y1="2" x2="12" y2="14" />
      </svg>
    );
  if (block === "Night")
    return (
      <svg {...common} className="text-indigo-400">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  return null;
}

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateKey(rawDate: string | Date): string {
  if (!rawDate) return getLocalDateString();
  if (rawDate instanceof Date) return getLocalDateString(rawDate);
  const str = String(rawDate).trim();
  const ymd = str.substring(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return getLocalDateString(parsed);
  } catch {}
  return ymd;
}

function dedupeLogs<T extends { id: string; logDate: string; timeBlock: string; subjectId: number; hoursStudied: number }>(logs: T[]): T[] {
  const seenIds = new Set<string>();
  const deduplicated: T[] = [];

  for (const log of logs) {
    if (seenIds.has(log.id)) continue;
    seenIds.add(log.id);

    const cleanDate = formatDateKey(log.logDate);
    deduplicated.push({
      ...log,
      logDate: cleanDate,
    });
  }
  return deduplicated;
}

const offlineQueueKey = "door_offline_logs_queue_v1";

function getOfflineQueue(): Array<Record<string, any>> {
  try {
    const raw = localStorage.getItem(offlineQueueKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: Array<Record<string, any>>) {
  try {
    localStorage.setItem(offlineQueueKey, JSON.stringify(queue));
  } catch {}
}

function enqueueOfflineLog(log: Record<string, any>) {
  const queue = getOfflineQueue();
  queue.push(log);
  saveOfflineQueue(queue);
}

async function flushOfflineQueue(backendUrl: string) {
  const queue = getOfflineQueue();
  if (queue.length === 0) return;
  const remaining: Array<Record<string, any>> = [];
  for (const log of queue) {
    try {
      const res = await fetch(`${backendUrl}/api/tracker/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log),
      });
      if (!res.ok) remaining.push(log);
    } catch {
      remaining.push(log);
    }
  }
  saveOfflineQueue(remaining);
}

function formatTimerDisplay(totalSecs: number): { hrs: string; mins: string; secs: string } {
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { hrs: pad(h), mins: pad(m), secs: pad(s) };
}

function formatHumanDuration(hoursNum: number): string {
  if (!hoursNum || hoursNum <= 0) return "0 mins";
  const totalMins = Math.round(hoursNum * 60);
  if (totalMins < 60) {
    return `${totalMins} ${totalMins === 1 ? "min" : "mins"}`;
  }
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) {
    return `${hrs} ${hrs === 1 ? "hr" : "hrs"}`;
  }
  return `${hrs} hr ${mins} min`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const cleanStr = formatDateKey(dateStr);
    const parts = cleanStr.split("-");
    if (parts.length !== 3) return dateStr;
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
    const d = new Date(year, month - 1, day);
    const monthName = d.toLocaleDateString("en-US", { month: "short" });
    return `${day} ${monthName} ${year}`;
  } catch {
    return dateStr;
  }
}



export default function TrackerPage() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [error, setError] = useState("");
  
  // Log Session Modal State
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logDate, setLogDate] = useState(() => getLocalDateString());
  const [logTimeBlock, setLogTimeBlock] = useState("Evening");
  const [logHours, setLogHours] = useState("1.5");
  const [logQuestions, setLogQuestions] = useState("10");
  const [logNotes, setLogNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Live Timer Mode State
  const [logMode, setLogMode] = useState<"manual" | "timer">("timer");
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerStartTimeStr, setTimerStartTimeStr] = useState<string | null>(null);
  const [timerType, setTimerType] = useState<"countup" | "pomodoro">("countup");
  const [activeRunningTimerType, setActiveRunningTimerType] = useState<"countup" | "pomodoro" | null>(null);
  const [pomodoroMinutes, setPomodoroMinutes] = useState<number>(25);
  const [isPomodoroDropdownOpen, setIsPomodoroDropdownOpen] = useState(false);
  const [pomodoroTargetTimeMs, setPomodoroTargetTimeMs] = useState<number | null>(null);
  const [floatingClockMode, setFloatingClockMode] = useState<"compact" | "medium">("compact");
  const [dragBounds, setDragBounds] = useState({ left: -300, right: 0, top: 0, bottom: 500 });
  const [nowDate, setNowDate] = useState(() => new Date());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (floatingClockMode === "medium") {
      inactivityTimerRef.current = setTimeout(() => {
        setFloatingClockMode("compact");
      }, 4000);
    }
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [floatingClockMode]);

  const handleFloatingWidgetActivity = () => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (floatingClockMode === "medium") {
      inactivityTimerRef.current = setTimeout(() => {
        setFloatingClockMode("compact");
      }, 4000);
    }
  };

  useEffect(() => {
    const updateBounds = () => {
      if (typeof window !== "undefined") {
        setDragBounds({
          left: -(window.innerWidth - 80),
          right: 0,
          top: 0,
          bottom: window.innerHeight - 120,
        });
      }
    };
    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timerRunning) {
      timer = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [timerRunning]);




  
  // Daily session logs state
  const [sessionLogs, setSessionLogs] = useState<Array<{
    id: string;
    logDate: string;
    timeBlock: string;
    subjectId: number;
    subjectName: string;
    hoursStudied: number;
    questionsSolved: number;
    notes: string | null;
  }>>([]);

  // D1 Reset Flow Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [verifyingPasscode, setVerifyingPasscode] = useState(false);

  // Add Subject Modal State
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectWeight, setNewSubjectWeight] = useState("10");
  const [newSubjectTopics, setNewSubjectTopics] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);

  // Delete Subject Modal State
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [isDeleteSubjectModalOpen, setIsDeleteSubjectModalOpen] = useState(false);
  const [deletingSubject, setDeletingSubject] = useState(false);


  // Editable Daily Goal State
  const [dailyGoal, setDailyGoal] = useState<number>(4.0);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [tempGoalInput, setTempGoalInput] = useState("4.0");
  const goalModalMouseDownRef = useRef(false);
  const [isLogsHistoryModalOpen, setIsLogsHistoryModalOpen] = useState(false);
  const logsHistoryMouseDownRef = useRef(false);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isAnyModalOpen = isLogsHistoryModalOpen || isLogModalOpen || isAddSubjectModalOpen || isGoalModalOpen || isDeleteModalOpen || isDeleteSubjectModalOpen;

  useEffect(() => {
    if (!isMounted) return;
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMounted, isAnyModalOpen]);


  const toggleDateExpand = (dateStr: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [dateStr]: prev[dateStr] === undefined ? false : !prev[dateStr],
    }));
  };




  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      try {
        localStorage.removeItem("door_study_tracker_data_v2");
        localStorage.removeItem("door_study_logs_history_v1");
        localStorage.removeItem("door_offline_logs_queue_v1");
      } catch {}

      const response = await fetch(`${backendUrl}/api/tracker/status?t=${Date.now()}`, {
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      });
      const result = (await response.json()) as TrackerData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Study progress could not be loaded.");
      setData(result);
      if (typeof result.dailyAvailableHours === "number" && result.dailyAvailableHours > 0) {
        setDailyGoal(result.dailyAvailableHours);
        try { localStorage.setItem("door_daily_goal_hours", result.dailyAvailableHours.toString()); } catch {}
      }

      let effectiveLogs: NonNullable<TrackerData["logs"]>[number][] = [];
      if (Array.isArray(result.logs) && result.logs.length > 0) {
        effectiveLogs = result.logs;
      } else if (Array.isArray(result.subjects)) {
        const todayStr = getLocalDateString();
        effectiveLogs = result.subjects
          .filter((s) => (s.cumulativeHours || s.hoursStudied || 0) > 0 || (s.cumulativeQuestions || s.questionsSolved || 0) > 0)
          .map((s) => ({
            id: `db-synced-${s.subjectId}`,
            logDate: todayStr,
            timeBlock: "Evening",
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            hoursStudied: s.cumulativeHours || s.hoursStudied || 0,
            questionsSolved: s.cumulativeQuestions || s.questionsSolved || 0,
            notes: "Cloud database session",
          }));
      }

      setSessionLogs(dedupeLogs(effectiveLogs));
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to connect to study tracker database.");
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    try {
      localStorage.removeItem("door_study_tracker_data_v2");
      localStorage.removeItem("door_study_logs_history_v1");
      localStorage.removeItem("door_offline_logs_queue_v1");
    } catch {}

    const savedGoal = localStorage.getItem("door_daily_goal_hours");
    if (savedGoal) {
      const parsed = parseFloat(savedGoal);
      if (!isNaN(parsed) && parsed > 0) setDailyGoal(parsed);
    }
    
    void refresh(false);
  }, [refresh]);

  const subjects = useMemo(() => data?.subjects || [], [data]);

  // Aggregate Metrics (Derived cleanly from sessionLogs stored in Prisma Postgres)
  const totalHours = useMemo(() => {
    return Number(sessionLogs.reduce((sum, l) => sum + l.hoursStudied, 0).toFixed(2));
  }, [sessionLogs]);

  const totalQuestions = useMemo(() => {
    return sessionLogs.reduce((sum, l) => sum + l.questionsSolved, 0);
  }, [sessionLogs]);

  const weeklyHours = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);

    const thisWeekLogs = sessionLogs.filter((l) => {
      const cleanDateStr = formatDateKey(l.logDate);
      const logDateObj = new Date(`${cleanDateStr}T00:00:00`);
      return logDateObj >= monday;
    });
    return Number(thisWeekLogs.reduce((sum, l) => sum + l.hoursStudied, 0).toFixed(2));
  }, [sessionLogs]);

  // Daily Chart Data Generator (Past N Days or All Time)
  const dailyChartData = useMemo<DailyLogEntry[]>(() => {
    let daysCount = 7;
    if (timeRange === "14d") daysCount = 14;
    else if (timeRange === "30d") daysCount = 30;
    else if (timeRange === "all") {
      if (sessionLogs.length > 0) {
        const dates = sessionLogs.map((l) => new Date(`${l.logDate}T00:00:00`).getTime()).filter((t) => !isNaN(t));
        if (dates.length > 0) {
          const minTime = Math.min(...dates);
          const nowTime = new Date().getTime();
          const diffDays = Math.ceil((nowTime - minTime) / (1000 * 60 * 60 * 24)) + 1;
          daysCount = Math.max(diffDays, 30);
        } else {
          daysCount = 30;
        }
      } else {
        daysCount = 30;
      }
    }

    const list: DailyLogEntry[] = [];
    const today = new Date();
    
    // Group session logs by normalized date
    const logsByDate = new Map<string, { hours: number; questions: number }>();
    for (const log of sessionLogs) {
      const cleanDate = formatDateKey(log.logDate);
      const existing = logsByDate.get(cleanDate) || { hours: 0, questions: 0 };
      logsByDate.set(cleanDate, {
        hours: existing.hours + log.hoursStudied,
        questions: existing.questions + log.questionsSolved,
      });
    }

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = getLocalDateString(d);
      const dayLabel = daysCount > 14
        ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
      const isToday = i === 0;

      const log = logsByDate.get(dateStr);
      const hours = log ? log.hours : 0;
      const questions = log ? log.questions : 0;

      list.push({ dateStr, dayLabel, hours, questions, isToday });
    }
    return list;
  }, [timeRange, sessionLogs]);

  const todayHours = useMemo(() => {
    const todayEntry = dailyChartData.find((d) => d.isToday);
    return todayEntry ? Number(todayEntry.hours.toFixed(2)) : 0;
  }, [dailyChartData]);

  const todayQuestions = useMemo(() => {
    const todayEntry = dailyChartData.find((d) => d.isToday);
    return todayEntry ? todayEntry.questions : 0;
  }, [dailyChartData]);

  const activeDaysCount = useMemo(() => {
    return dailyChartData.filter((d) => d.hours > 0).length;
  }, [dailyChartData]);

  const dailyAvg = useMemo(() => {
    const rangeTotal = dailyChartData.reduce((sum, l) => sum + l.hours, 0);
    if (activeDaysCount === 0) return 0;
    return Number((rangeTotal / activeDaysCount).toFixed(1));
  }, [dailyChartData, activeDaysCount]);

  const logsByDateGroups = useMemo(() => {
    const map = new Map<string, Array<typeof sessionLogs[0]>>();
    for (const log of sessionLogs) {
      const cleanDate = formatDateKey(log.logDate);
      const existing = map.get(cleanDate) || [];
      existing.push(log);
      map.set(cleanDate, existing);
    }
    return Array.from(map.entries())
      .map(([date, logs]) => {
        const dayTotalHours = Number(logs.reduce((sum, l) => sum + l.hoursStudied, 0).toFixed(2));
        const dayTotalQuestions = logs.reduce((sum, l) => sum + l.questionsSolved, 0);
        return { date, logs, dayTotalHours, dayTotalQuestions };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessionLogs]);






  const maxChartHours = useMemo(() => {
    const maxVal = Math.max(...dailyChartData.map((d) => d.hours), dailyGoal);
    return Math.ceil(maxVal);
  }, [dailyChartData, dailyGoal]);

  const handleSaveDailyGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(tempGoalInput);
    if (isNaN(parsed) || parsed <= 0 || parsed > 24) {
      toast.error("Please enter a valid daily goal between 0.5 and 24 hours.");
      return;
    }
    setDailyGoal(parsed);
    try { localStorage.setItem("door_daily_goal_hours", parsed.toString()); } catch {}
    setIsGoalModalOpen(false);
    toast.success(`Daily goal updated to ${parsed.toFixed(1)} hours / day!`);

    try {
      await fetch(`${backendUrl}/api/tracker/goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyAvailableHours: parsed }),
      });
    } catch (err) {
      console.warn("Could not save daily goal to cloud database:", err);
    }
  };

  // Filtered Subjects
  const visibleSubjects = useMemo(() => {
    return subjects.filter((subject) => {
      if (filter === "high") return subject.importanceLevel >= 0.1;
      if (filter === "recent") return (subject.hoursStudied || 0) > 0;
      if (filter === "active") return (subject.questionsSolved || 0) > 0;
      return true;
    });
  }, [subjects, filter]);

  // Handle Quick Session Logging
  const openLogModal = (subject?: Subject) => {
    if (subject) {
      setSelectedSubject(subject);
    } else if (subjects.length > 0) {
      setSelectedSubject(subjects[0]);
    }
    setLogDate(getLocalDateString());
    setLogTimeBlock("Evening");
    setLogHours("1.5");
    setLogQuestions("10");
    setLogNotes("");
    setLogMode("timer");
    setIsLogModalOpen(true);
  };

  const executeSavePipeline = async (
    targetSubject: Subject,
    rawDateStr: string,
    timeBlockLabel: string,
    hoursNum: number,
    qNum: number,
    notesStr: string | null,
    isTimer = false
  ) => {
    setSaving(true);
    const cleanDate = formatDateKey(rawDateStr);

    if (isTimer) {
      handleResetTimer();
    }
    setIsLogModalOpen(false);

    try {
      const response = await fetch(`${backendUrl}/api/tracker/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logDate: cleanDate,
          timeBlock: timeBlockLabel,
          subjectId: targetSubject.subjectId,
          subjectName: targetSubject.subjectName,
          hoursStudied: hoursNum,
          questionsSolved: qNum,
          notes: notesStr,
        }),
      });

      if (!response.ok) throw new Error("Cloud database save failed.");

      toast.success(`Logged ${hoursNum}h of ${targetSubject.subjectName} to cloud!`);
      await refresh(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cloud database save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSessionLog = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSubject) return;
    const hoursNum = Number(logHours) || 0;
    const qNum = Number(logQuestions) || 0;
    if (hoursNum <= 0) {
      toast.error("Please enter study hours greater than 0.");
      return;
    }
    await executeSavePipeline(selectedSubject, logDate, logTimeBlock, hoursNum, qNum, logNotes || null, false);
  };

  const handleStartTimer = () => {
    if (!timerStartTimeStr) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      setTimerStartTimeStr(timeStr);
    }
    setTimerRunning(true);
    setActiveRunningTimerType(timerType);
    if (timerType === "pomodoro" && !pomodoroTargetTimeMs) {
      setPomodoroTargetTimeMs(Date.now() + pomodoroMinutes * 60 * 1000);
    }
  };

  const handlePauseTimer = () => {
    setTimerRunning(false);
  };

  const handleResetTimer = () => {
    setTimerRunning(false);
    setTimerSeconds(0);
    setTimerStartTimeStr(null);
    setActiveRunningTimerType(null);
    setPomodoroTargetTimeMs(null);
  };

  const handleFinishTimerSession = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSubject) return;
    if (timerSeconds < 5) {
      toast.error("Please run the clock for at least a few seconds before saving.");
      return;
    }
    const hoursNum = Number((timerSeconds / 3600).toFixed(2)) || 0.01;
    const qNum = Number(logQuestions) || 0;
    const timeBlockLabel = timerStartTimeStr ? `@ ${timerStartTimeStr}` : "Live";
    const notesStr = logNotes || `Live clock session (${Math.ceil(timerSeconds / 60)} mins)`;
    await executeSavePipeline(selectedSubject, getLocalDateString(), timeBlockLabel, hoursNum, qNum, notesStr, true);
  };


  const handleAddSubject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newSubjectName.trim()) {
      toast.error("Please enter a subject name.");
      return;
    }

    setSavingSubject(true);
    try {
      const weightFloat = (Number(newSubjectWeight) || 10) / 100;
      const topicsArr = newSubjectTopics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const response = await fetch(`${backendUrl}/api/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectName: newSubjectName.trim(),
          importanceLevel: weightFloat,
          topics: topicsArr,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not create new subject.");
      }

      const created = await response.json();
      setIsAddSubjectModalOpen(false);
      setNewSubjectName("");
      setNewSubjectWeight("10");
      setNewSubjectTopics("");
      await refresh(true);
      toast.success(`Subject "${created.subjectName || newSubjectName}" added successfully!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add subject.");
    } finally {
      setSavingSubject(false);
    }
  };

  const openDeleteSubjectModal = (subject: Subject) => {
    setSubjectToDelete(subject);
    setIsDeleteSubjectModalOpen(true);
  };

  const handleDeleteSubject = async () => {
    if (!subjectToDelete) return;
    setDeletingSubject(true);
    const targetId = subjectToDelete.subjectId;
    const targetName = subjectToDelete.subjectName;

    try {
      const response = await fetch(`${backendUrl}/api/subjects/${targetId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const resData = await response.json().catch(() => ({}));
        throw new Error(resData.error || "Could not delete subject.");
      }

      setIsDeleteSubjectModalOpen(false);
      setSubjectToDelete(null);

      // Optimistic UI update: Remove deleted subject immediately without needing a manual refresh
      setData((prev) => {
        if (!prev) return prev;
        const updatedSubjects = prev.subjects.filter((s) => s.subjectId !== targetId);
        const updatedData = { ...prev, subjects: updatedSubjects };
        localStorage.setItem(cacheKey, JSON.stringify(updatedData));
        return updatedData;
      });

      await refresh(true);
      toast.success(`Subject "${targetName}" deleted successfully!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete subject.");
    } finally {
      setDeletingSubject(false);
    }
  };



  // Open 2-Step D1 Reset Flow
  const openDeleteFlow = () => {
    setDeleteStep(1);
    setPasscode("");
    setPasscodeError("");
    setIsDeleteModalOpen(true);
  };

  // Step 2: Confirm Passcode & Execute D1 Wipe
  const handleConfirmDeleteWithPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) {
      setPasscodeError("Please enter your app passcode.");
      return;
    }

    setVerifyingPasscode(true);
    setPasscodeError("");

    try {
      // 1. Verify app login passcode via /api/auth
      const authRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (!authRes.ok) {
        setPasscodeError("Incorrect app passcode. Access denied.");
        setVerifyingPasscode(false);
        return;
      }

      // 2. Execute D1 database reset
      const resetRes = await fetch(`${backendUrl}/api/tracker/reset`, { method: "POST" });
      if (!resetRes.ok) throw new Error("Could not reset tracker database.");

      localStorage.removeItem(logsCacheKey);
      setSessionLogs([]);
      setIsDeleteModalOpen(false);
      await refresh(true);
      toast.success("Study tracker logs successfully deleted from Cloudflare D1.");
    } catch (err) {
      setPasscodeError(err instanceof Error ? err.message : "Failed to reset tracker database.");
    } finally {
      setVerifyingPasscode(false);
    }
  };

  return (
    <AppShell
      eyebrow="Study Hours & Progress"
      title="Study Tracker"
      subtitle="Track your study hours, session timelines, and subject effort"
      actions={
        <div className="flex items-center gap-2">
          <MicroInteractionButton
            onClick={() => setIsAddSubjectModalOpen(true)}
            className="btn-secondary flex items-center gap-1.5 py-1.5 text-xs font-semibold"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Subject
          </MicroInteractionButton>
          <MicroInteractionButton
            onClick={() => openLogModal()}
            className="btn-primary flex items-center gap-1.5 py-1.5 text-xs font-semibold"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Log Session
          </MicroInteractionButton>
          <MicroInteractionButton
            onClick={() => void refresh()}
            loading={loading}
            className="btn-secondary py-1.5 text-xs"
          >
            Refresh
          </MicroInteractionButton>
        </div>
      }
    >
      {error ? (
        <div className="mb-5 rounded-lg bg-[var(--danger-soft)] p-3 text-sm font-semibold text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {/* Metric Cards Header */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Today's Study Time"
          value={todayHours}
          suffix="hrs"
          subtext="Logged today"
          iconType="time"
        />
        <MetricCard
          label="This Week's Effort"
          value={weeklyHours}
          suffix="hrs"
          subtext="Current week"
          iconType="effort"
        />
        <MetricCard
          label="Daily Average"
          value={dailyAvg}
          suffix="hrs/day"
          subtext={
            activeDaysCount > 0
              ? `${activeDaysCount} active ${activeDaysCount === 1 ? "day" : "days"} (${timeRange === "all" ? "All Time" : "Past " + timeRange})`
              : timeRange === "all" ? "All Time" : `Past ${timeRange}`
          }
          iconType="avg"
          decimals={1}
        />

        <MetricCard
          label="Today's Questions Solved"
          value={todayQuestions}
          suffix="problems"
          subtext="Solved today"
          iconType="questions"
        />

      </section>

      {/* Daily Study Graph Section */}
      <PageSection
        title="Daily Study Hours"
        titleClassName="text-lg font-semibold tracking-tight text-[var(--text-primary)]"
        className="mt-6"
        headerClassName="mb-4"
        action={
          <div className="relative flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1 z-0">
            {(["7d", "14d", "30d", "all"] as TimeRange[]).map((r) => {
              const isSelected = timeRange === r;
              const label = r === "7d" ? "7 Days" : r === "14d" ? "14 Days" : r === "30d" ? "30 Days" : "All Time";
              return (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={`focus-ring relative z-10 rounded-lg px-3 py-1 text-xs font-bold transition-colors duration-200 ${
                    isSelected ? "text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeTimeRange"
                      className="absolute inset-0 rounded-lg bg-[var(--bg-card)] border border-[var(--accent)]/20 shadow-xs -z-10"
                      transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.8 }}
                    />
                  )}
                  {label}
                </button>
              );
            })}
          </div>
        }
      >
        <div className="surface p-5">
          {/* Chart Header Info */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div className="flex items-center gap-2.5">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Daily Goal: <span className="font-bold text-[var(--text-primary)]">{dailyGoal.toFixed(1)} hours / day</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setTempGoalInput(dailyGoal.toString());
                  setIsGoalModalOpen(true);
                }}
                className="rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10.5px] font-bold text-[var(--accent)] hover:border-[var(--accent)] transition"
              >
                Set Goal
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-[var(--accent)]" /> Studied Hours
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-[var(--accent)]/40 border-t border-dashed border-[var(--accent)]" /> Daily Target ({dailyGoal}h)
              </span>
            </div>
          </div>

          {/* Bar Chart Container with hidden scrollbars */}
          <div className="relative w-full pt-12 pb-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Y-Axis Plot Area */}
            <div
              className="relative h-48 min-w-full"
              style={{ width: dailyChartData.length > 25 ? `${dailyChartData.length * 24}px` : "100%" }}
            >
              {/* Target Line */}
              <div
                className="absolute left-0 right-0 z-0 border-b border-dashed border-[var(--accent)]/40 pointer-events-none"
                style={{ bottom: `${Math.min((dailyGoal / maxChartHours) * 100, 100)}%` }}
              />

              {/* Bars flex row */}
              <div className="relative z-10 flex h-full items-end justify-between gap-1 sm:gap-1.5 w-full">
                {dailyChartData.map((d, idx) => {
                  const heightPercent = Math.max((d.hours / maxChartHours) * 100, 3);
                  const isLast = idx >= dailyChartData.length - 2;
                  const isFirst = idx <= 1;
                  const tooltipPos = isLast ? "right-0" : isFirst ? "left-0" : "left-1/2 -translate-x-1/2";
                  const isHigh = heightPercent > 70;
                  const tooltipY = isHigh ? "top-2" : "-top-11";

                  return (
                    <div key={d.dateStr || idx} className="group relative flex flex-1 flex-col items-center h-full justify-end">
                      {/* Hover Tooltip - Positioned safely inside container bounds */}
                      <div className={`absolute ${tooltipY} z-40 hidden rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-center text-[10px] font-bold text-[var(--text-primary)] shadow-md group-hover:block whitespace-nowrap pointer-events-none ${tooltipPos}`}>
                        <div>{d.dayLabel}</div>
                        <div className="text-[var(--accent)]">{d.hours} hrs studied</div>
                        {d.questions > 0 && <div className="text-[var(--text-secondary)]">{d.questions} Qs solved</div>}
                      </div>


                      {/* Bar */}
                      <motion.div
                        layout
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: `${heightPercent}%`, opacity: 1 }}
                        whileHover={{ scaleY: 1.06, scaleX: 1.08, originY: 1 }}
                        transition={{
                          height: { type: "spring", stiffness: 220, damping: 19, mass: 0.8 },
                          opacity: { duration: 0.2 },
                          scaleY: { type: "spring", stiffness: 400, damping: 25 },
                        }}
                        className={`w-full max-w-[28px] rounded-t-md cursor-pointer transition-colors ${
                          d.isToday
                            ? "bg-[var(--accent)] shadow-sm shadow-[var(--accent)]/30"
                            : d.hours >= 4
                            ? "bg-[var(--accent)]"
                            : d.hours > 0
                            ? "bg-[var(--accent)]/70"
                            : "bg-[var(--track)] opacity-60"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X-Axis Day Labels Row */}
            <div
              className="flex items-center justify-between gap-1 sm:gap-1.5 min-w-full pt-2.5 mt-1 border-t border-[var(--border)]/60"
              style={{ width: dailyChartData.length > 25 ? `${dailyChartData.length * 24}px` : "100%" }}
            >
              {dailyChartData.map((d, idx) => (
                <div key={d.dateStr || idx} className="flex-1 text-center">
                  <span className={`text-[10px] font-semibold truncate block ${d.isToday ? "text-[var(--accent)] font-extrabold" : "text-[var(--text-secondary)]"}`}>
                    {d.dayLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </PageSection>

      {/* Subject Effort Breakdown Section */}
      <PageSection
        title="Subject Effort Breakdown"
        titleClassName="text-lg font-semibold tracking-tight text-[var(--text-primary)]"
        className="mt-6"
        headerClassName="mb-4"
        action={
          <div className="relative flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] p-1 z-0">
            {filters.map((f) => {
              const isSelected = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`focus-ring relative z-10 rounded-full px-3.5 py-1 text-xs font-bold transition-colors duration-200 ${
                    isSelected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeFilterTab"
                      className="absolute inset-0 rounded-full bg-[var(--bg-card)] border border-[var(--border)] shadow-xs -z-10"
                      transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.8 }}
                    />
                  )}
                  {f.label}
                </button>
              );
            })}
          </div>
        }
      >
        {loading && !data ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="surface h-36 animate-pulse bg-[var(--track)]" />
            ))}
          </div>
        ) : visibleSubjects.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleSubjects.map((subject) => {
              const subLogs = sessionLogs.filter((l) => l.subjectId === subject.subjectId);
              const subHours = subLogs.length > 0
                ? Number(subLogs.reduce((sum, l) => sum + l.hoursStudied, 0).toFixed(2))
                : subject.cumulativeHours || subject.hoursStudied || 0;
              const subQuestions = subLogs.length > 0
                ? subLogs.reduce((sum, l) => sum + l.questionsSolved, 0)
                : subject.cumulativeQuestions || subject.questionsSolved || 0;
              const progressPct = Math.min((subHours / 30) * 100, 100);

              return (
                <article key={subject.subjectId} className="surface p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-sm leading-tight text-[var(--text-primary)]">
                          {subject.subjectName}
                        </h3>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Exam Weight {Math.round(subject.importanceLevel * 100)}%
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full border border-[var(--accent)]/15 bg-[var(--accent-soft)] px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--accent)] shrink-0">
                        {subHours} hrs
                      </span>
                    </div>

                    <div className="mt-3">
                      <ProgressBar value={progressPct} tone="blue" />
                    </div>

                    <p className="mt-3 line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {subject.topics.join(", ")}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                      {subQuestions} Qs solved
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openDeleteSubjectModal(subject)}
                        title={`Delete ${subject.subjectName}`}
                        className="rounded-md p-1.5 text-[var(--text-secondary)] transition hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openLogModal(subject)}
                        className="btn-secondary py-1 text-xs font-semibold min-h-[1.8rem]"
                      >
                        + Log Time
                      </button>
                    </div>
                  </div>

                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            mark="S"
            title="No subjects match filter"
            description="Try changing the filter option to see more subjects."
            className="min-h-[240px]"
          />
        )}
      </PageSection>

      {/* Compact Single-Line Recent Logs Banner */}
      {sessionLogs.length > 0 ? (
        <div className="mt-4">
          <div
            onClick={() => setIsLogsHistoryModalOpen(true)}
            className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 shadow-xs transition hover:border-[var(--accent)]/50 hover:bg-[var(--bg-elevated)]"
          >
            <div className="flex items-center gap-2.5 text-xs truncate">
              <span className="font-extrabold text-[var(--text-primary)] shrink-0">
                Recent Logs:
              </span>
              <span className="truncate font-semibold text-[var(--text-secondary)]">
                {sessionLogs[0].subjectName} — {formatHumanDuration(sessionLogs[0].hoursStudied)} on {formatDisplayDate(sessionLogs[0].logDate)}
                {sessionLogs.length > 1 ? ` (+${sessionLogs.length - 1} more sessions)` : ""}
              </span>


            </div>

            <div className="flex items-center gap-1 shrink-0 text-xs font-extrabold text-[var(--accent)] group-hover:translate-x-0.5 transition-transform">
              <span>View All Logs ({sessionLogs.length})</span>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>
        </div>
      ) : null}


      {/* Danger Zone: Bottom Database Maintenance Section */}
      <PageSection title="Database Maintenance" className="mt-8 mb-6">
        <div className="surface p-5 flex flex-wrap items-center justify-between gap-4 border border-rose-500/20 bg-rose-500/5">
          <div>
            <h4 className="text-sm font-bold text-[var(--text-primary)]">Reset Study Tracker Logs</h4>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Permanently delete recorded study session history from the Cloudflare D1 database. Other project data (journals, settings) will not be affected.
            </p>
          </div>
          <MicroInteractionButton
            onClick={openDeleteFlow}
            className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/20 transition shrink-0 cursor-pointer"
          >
            Clear D1 Logs
          </MicroInteractionButton>
        </div>
      </PageSection>      {/* Log Study Session Modal with Non-Scrollable Centered Stage */}
      {isMounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isLogModalOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-black/50 p-4 sm:p-6 backdrop-blur-md"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setIsLogModalOpen(false);
              }}
            >
              <motion.form
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                onSubmit={logMode === "manual" ? handleSaveSessionLog : handleFinishTimerSession}
                onClick={(e) => e.stopPropagation()}
                className="surface w-full max-w-xl space-y-5 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl border border-[var(--border)] relative overflow-hidden rounded-3xl my-auto"
              >
                {/* Segmented Mode Switcher with Subtle Pill and Colored Text Tags */}
                <div className="border-b border-[var(--border)] pb-3">
                  <div className="relative flex items-center rounded-2xl bg-[var(--bg-elevated)] p-1 text-xs font-bold w-full border border-[var(--border)]/60">
                    <button
                      type="button"
                      onClick={() => setLogMode("manual")}
                      className={`relative flex-1 rounded-xl py-2 text-center transition-colors z-10 font-bold cursor-pointer ${
                        logMode === "manual" ? "text-teal-400 font-extrabold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {logMode === "manual" && (
                        <motion.div
                          layoutId="activeLogTabPill"
                          className="absolute inset-0 rounded-xl bg-[var(--bg-card)] shadow-sm border border-[var(--border)]"
                          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center gap-1.5 font-extrabold">
                        Manual Log
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLogMode("timer")}
                      className={`relative flex-1 rounded-xl py-2 text-center transition-colors z-10 font-bold cursor-pointer ${
                        logMode === "timer" ? "text-amber-400 font-extrabold" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {logMode === "timer" && (
                        <motion.div
                          layoutId="activeLogTabPill"
                          className="absolute inset-0 rounded-xl bg-[var(--bg-card)] shadow-sm border border-[var(--border)]"
                          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center gap-1.5 font-extrabold">
                        <span>Live Clock</span>
                      </span>
                    </button>
                  </div>
                </div>

                {/* Shared Top Controls: Subject Selection & Questions Solved */}
                <div className="grid grid-cols-2 gap-3 pb-1">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">
                      Subject
                    </label>
                    <select
                      value={selectedSubject?.subjectId || ""}
                      onChange={(e) => {
                        const sub = subjects.find((s) => s.subjectId === Number(e.target.value));
                        if (sub) setSelectedSubject(sub);
                      }}
                      className="app-input w-full px-3.5 py-2.5 text-sm font-semibold"
                    >
                      {subjects.map((s) => (
                        <option key={s.subjectId} value={s.subjectId}>
                          {s.subjectName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">
                      Questions Solved
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={logQuestions}
                      onChange={(e) => setLogQuestions(e.target.value)}
                      placeholder="0"
                      className="app-input w-full px-3.5 py-2.5 text-sm font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                {/* Continuous Dual Viewport Stage (200% Width GPU Slider) */}
                <div className="relative w-full overflow-hidden">
                  <div
                    className={`flex w-[200%] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      logMode === "manual" ? "translate-x-0" : "-translate-x-1/2"
                    }`}
                  >
                    {/* PANEL 1: MANUAL LOG FORM */}
                    <div className="w-1/2 pr-3 flex flex-col justify-between space-y-4">
                      {/* Date & Time Block with Good Spacing */}
                      <div className="grid grid-cols-2 gap-3.5 pt-1">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">
                            Date
                          </label>
                          <input
                            type="date"
                            value={logDate}
                            onChange={(e) => setLogDate(e.target.value)}
                            className="app-input w-full px-3.5 py-2.5 text-xs font-semibold"
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">
                            Time Block
                          </label>
                          <select
                            value={logTimeBlock}
                            onChange={(e) => setLogTimeBlock(e.target.value)}
                            className="app-input w-full px-3.5 py-2.5 text-xs font-semibold"
                          >
                            {timeBlocks.map((tb) => (
                              <option key={tb.id} value={tb.id}>
                                {tb.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Hours Studied */}
                      <div className="pt-1">
                        <label className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">
                          Hours Studied
                        </label>
                        <input
                          type="number"
                          min="0.25"
                          max="18"
                          step="0.25"
                          value={logHours}
                          onChange={(e) => setLogHours(e.target.value)}
                          className="app-input w-full px-3.5 py-2.5 text-sm font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>

                      {/* Notes / Topics Covered - Generous Height to Fill Frame */}
                      <div className="pt-1 flex-1 flex flex-col">
                        <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                          Notes / Sub-topics Covered
                        </label>
                        <textarea
                          value={logNotes}
                          onChange={(e) => setLogNotes(e.target.value)}
                          placeholder="e.g. Graph BFS/DFS problems, revised time complexity..."
                          className="app-input min-h-[140px] sm:min-h-[155px] w-full p-3.5 text-xs leading-relaxed flex-1"
                        />
                      </div>

                      {/* Action Buttons Cleanly Anchored at Bottom */}
                      <div className="flex justify-end gap-2.5 pt-3.5 border-t border-[var(--border)] mt-auto">
                        <button
                          type="button"
                          onClick={() => setIsLogModalOpen(false)}
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <MicroInteractionButton
                          type="submit"
                          loading={saving}
                          className="btn-primary px-5 py-2 text-xs font-semibold"
                        >
                          Save Log
                        </MicroInteractionButton>
                      </div>
                    </div>

                    {/* PANEL 2: LIVE CLOCK STOPWATCH */}
                    <div className="w-1/2 pl-3 flex flex-col items-center justify-between space-y-4">
                      {/* Segmented Timer Mode Sub-Toggle with Downward Dropdown */}
                      <div className="relative flex items-center justify-between rounded-2xl bg-[var(--bg-elevated)] p-1 text-xs font-bold w-full max-w-xs border border-[var(--border)]/60 shadow-inner">
                        <button
                          type="button"
                          onClick={() => {
                            setTimerType("countup");
                            setIsPomodoroDropdownOpen(false);
                          }}
                          className={`relative flex-1 rounded-xl py-2 text-center transition-colors z-10 font-bold cursor-pointer ${
                            timerType === "countup"
                              ? "text-[var(--text-primary)] font-extrabold"
                              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          Stopwatch
                          {timerType === "countup" && (
                            <motion.div
                              layoutId="activeSubTimerTab"
                              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                              className="absolute inset-0 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-md -z-10"
                            />
                          )}
                        </button>

                        <div className="relative flex-1">
                          <div
                            className={`relative w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-center transition-colors z-10 font-bold ${
                              timerType === "pomodoro"
                                ? "text-amber-400 font-extrabold"
                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            <span
                              onClick={() => {
                                if (timerType !== "pomodoro") {
                                  setTimerType("pomodoro");
                                }
                              }}
                              className="cursor-pointer"
                            >
                              Pomodoro
                            </span>

                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                if (timerType !== "pomodoro") {
                                  setTimerType("pomodoro");
                                }
                                setIsPomodoroDropdownOpen((prev) => !prev);
                              }}
                              className="inline-flex items-center gap-1 cursor-pointer hover:text-amber-300 transition-colors"
                            >
                              ({pomodoroMinutes}m)
                              <svg
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                  isPomodoroDropdownOpen ? "rotate-180 text-amber-400" : "opacity-60 hover:opacity-100"
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </span>

                            {timerType === "pomodoro" && (
                              <motion.div
                                layoutId="activeSubTimerTab"
                                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute inset-0 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] shadow-md -z-10"
                              />
                            )}
                          </div>

                          {/* Invisible Backdrop to Close Dropdown on Click Blank Area */}
                          {isPomodoroDropdownOpen && (
                            <div
                              className="fixed inset-0 z-40 bg-transparent cursor-default"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsPomodoroDropdownOpen(false);
                              }}
                            />
                          )}

                          {/* Downward Dropdown Menu Center-Aligned Directly Under Pomodoro Tab */}
                          <AnimatePresence>
                            {isPomodoroDropdownOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                                animate={{ opacity: 1, y: 2, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-36 rounded-2xl border border-amber-500/30 bg-[var(--bg-card)]/95 p-1.5 shadow-2xl backdrop-blur-2xl space-y-1"
                              >
                                {[25, 45, 60].map((m) => (
                                  <motion.button
                                    key={m}
                                    type="button"
                                    whileTap={{ scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    onClick={() => {
                                      setTimerType("pomodoro");
                                      setPomodoroMinutes(m);
                                      if (timerRunning) {
                                        setPomodoroTargetTimeMs(Date.now() + m * 60 * 1000);
                                      } else {
                                        setPomodoroTargetTimeMs(null);
                                      }
                                      setTimeout(() => setIsPomodoroDropdownOpen(false), 380);
                                    }}
                                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                                      timerType === "pomodoro" && pomodoroMinutes === m
                                        ? "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-stone-950 font-black shadow-md shadow-amber-500/20 border border-amber-300/40"
                                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
                                    }`}
                                  >
                                    <span>{m} minutes</span>
                                    {timerType === "pomodoro" && pomodoroMinutes === m && <span className="text-xs font-black">✓</span>}
                                  </motion.button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* Glassmorphic Stationary Ambient Halo & Anti-Clockwise Spinning Precision Analog Clock */}
                      <div className="relative flex flex-col items-center justify-center my-2 [perspective:1000px]">
                        {/* Stationary Anchored Ambient Halo Shadow (Does NOT rotate or jump) */}
                        <div
                          className={`absolute inset-0 m-auto h-52 w-52 sm:h-56 sm:w-56 rounded-full blur-3xl pointer-events-none transition-opacity duration-1000 ${
                            timerType === "pomodoro" ? "bg-amber-500/20" : "bg-[var(--accent)]/20"
                          } ${timerRunning ? "opacity-100" : "opacity-35"}`}
                        />

                        {/* Anti-Clockwise 360deg Spinning Premium Dial Container (100% Unobstructed Dial Face) */}
                        <motion.div
                          key={`clock-dial-spin-${timerType}`}
                          initial={{ rotate: timerType === "pomodoro" ? -360 : 360, scale: 0.94 }}
                          animate={{ rotate: 0, scale: 1 }}
                          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                          className="relative flex h-52 w-52 sm:h-56 sm:w-56 flex-col items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-2xl backdrop-blur-3xl"
                        >
                          
                          {/* SVG Analog Wall Clock Face */}
                          <svg className="absolute inset-0 h-full w-full pointer-events-none p-2" viewBox="0 0 100 100">
                            <defs>
                              <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="0.8" result="blur" />
                                <feMerge>
                                  <feMergeNode in="blur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>

                            {/* Perimeter Track */}
                            <circle
                              cx="50"
                              cy="50"
                              r="45"
                              className="stroke-[var(--border)] fill-none"
                              strokeWidth="1.2"
                            />

                            {/* Hollow Replica Clock Hands (Parallel dotted outline edge lines | | completely empty inside, STATIONARY & FROZEN at target finish time) */}
                            {((timerRunning && activeRunningTimerType === "pomodoro") || (!timerRunning && timerType === "pomodoro")) && (() => {
                              let targetMin = 0;
                              let targetHr = 0;

                              if (pomodoroTargetTimeMs) {
                                const targetDate = new Date(pomodoroTargetTimeMs);
                                targetMin = targetDate.getMinutes();
                                targetHr = (targetDate.getHours() % 12) + targetMin / 60;
                              } else {
                                const baseMin = nowDate.getMinutes();
                                const baseHr = (nowDate.getHours() % 12) + baseMin / 60;
                                targetMin = (baseMin + pomodoroMinutes) % 60;
                                targetHr = (baseHr + pomodoroMinutes / 60) % 12;
                              }

                              const targetMinDeg = targetMin * 6;
                              const targetHrDeg = targetHr * 30;

                              return (
                                <g className="transition-transform duration-500">
                                  {/* 1. Hollow Replica Hour Hand (Parallel Dotted Lines | | completely empty inside) */}
                                  <g transform={`rotate(${targetHrDeg} 50 50)`}>
                                    {/* Left Dotted Edge */}
                                    <line
                                      x1="48.5"
                                      y1="50"
                                      x2="48.5"
                                      y2="28"
                                      className="stroke-amber-400/85"
                                      strokeWidth="0.8"
                                      strokeDasharray="1.5 1.5"
                                    />
                                    {/* Right Dotted Edge */}
                                    <line
                                      x1="51.5"
                                      y1="50"
                                      x2="51.5"
                                      y2="28"
                                      className="stroke-amber-400/85"
                                      strokeWidth="0.8"
                                      strokeDasharray="1.5 1.5"
                                    />
                                    {/* Top Dotted Cap Line */}
                                    <line
                                      x1="48.5"
                                      y1="28"
                                      x2="51.5"
                                      y2="28"
                                      className="stroke-amber-400/85"
                                      strokeWidth="0.8"
                                      strokeDasharray="1.5 1.5"
                                    />
                                  </g>

                                  {/* 2. Hollow Replica Minute Hand (Parallel Dotted Lines | | completely empty inside) */}
                                  <g transform={`rotate(${targetMinDeg} 50 50)`}>
                                    {/* Left Dotted Edge */}
                                    <line
                                      x1="48.8"
                                      y1="50"
                                      x2="48.8"
                                      y2="18"
                                      className="stroke-black dark:stroke-neutral-950/90"
                                      strokeWidth="0.8"
                                      strokeDasharray="1.5 1.5"
                                    />
                                    {/* Right Dotted Edge */}
                                    <line
                                      x1="51.2"
                                      y1="50"
                                      x2="51.2"
                                      y2="18"
                                      className="stroke-black dark:stroke-neutral-950/90"
                                      strokeWidth="0.8"
                                      strokeDasharray="1.5 1.5"
                                    />
                                    {/* Top Dotted Cap Line */}
                                    <line
                                      x1="48.8"
                                      y1="18"
                                      x2="51.2"
                                      y2="18"
                                      className="stroke-black dark:stroke-neutral-950/90"
                                      strokeWidth="0.8"
                                      strokeDasharray="1.5 1.5"
                                    />
                                  </g>
                                </g>
                              );
                            })()}

                            {/* 60 Minute Thin Tick Marks & 12 Main Markers */}
                            {[...Array(60)].map((_, i) => {
                              const angle = i * 6;
                              const rad = (angle - 90) * (Math.PI / 180);
                              const isMajor = i % 5 === 0;
                              const tickLength = isMajor ? 4.5 : 2;
                              const x1 = 50 + (43 - tickLength) * Math.cos(rad);
                              const y1 = 50 + (43 - tickLength) * Math.sin(rad);
                              const x2 = 50 + 43 * Math.cos(rad);
                              const y2 = 50 + 43 * Math.sin(rad);
                              return (
                                <line
                                  key={i}
                                  x1={x1}
                                  y1={y1}
                                  x2={x2}
                                  y2={y2}
                                  className={isMajor ? (timerType === "pomodoro" ? "stroke-amber-400/70" : "stroke-[var(--accent)]/70") : "stroke-[var(--text-secondary)] opacity-30"}
                                  strokeWidth={isMajor ? "1.2" : "0.7"}
                                  strokeLinecap="round"
                                />
                              );
                            })}

                            {/* PROMINENT REAL-WORLD TIME ANALOG CLOCK HANDS */}
                            {(() => {
                              const curSec = nowDate.getSeconds() + nowDate.getMilliseconds() / 1000;
                              const curMin = nowDate.getMinutes() + curSec / 60;
                              const curHr = (nowDate.getHours() % 12) + curMin / 60;

                              const secDeg = curSec * 6;
                              const minDeg = curMin * 6;
                              const hrDeg = curHr * 30;

                              return (
                                <>
                                  {/* Hour Hand */}
                                  <line
                                    x1="50"
                                    y1="50"
                                    x2="50"
                                    y2="28"
                                    className={timerType === "pomodoro" ? "stroke-amber-400/90" : "stroke-[var(--accent)]"}
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    transform={`rotate(${hrDeg} 50 50)`}
                                  />

                                  {/* Minute Hand */}
                                  <line
                                    x1="50"
                                    y1="50"
                                    x2="50"
                                    y2="18"
                                    className="stroke-[var(--text-primary)]"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    transform={`rotate(${minDeg} 50 50)`}
                                  />

                                  {/* Second Hand */}
                                  <line
                                    x1="50"
                                    y1="50"
                                    x2="50"
                                    y2="12"
                                    className="stroke-rose-500/90"
                                    strokeWidth="1.2"
                                    strokeLinecap="round"
                                    transform={`rotate(${secDeg} 50 50)`}
                                  />

                                  {/* Center Pin Cap */}
                                  <circle
                                    cx="50"
                                    cy="50"
                                    r="3"
                                    className="fill-rose-500 stroke-[var(--bg-card)]"
                                    strokeWidth="1"
                                  />
                                </>
                              );
                            })()}
                          </svg>
                        </motion.div>
                      </div>

                      {/* Stationary Non-Rotating Digital Display Badge Placed Cleanly Outside Below Analog Clock Dial */}
                      <motion.div
                        key={`digital-badge-${timerType}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/90 px-4 py-1.5 shadow-xs backdrop-blur-md"
                      >
                        <span className="font-sans text-xs font-semibold tracking-wider text-[var(--text-primary)]">
                          {(() => {
                            const isPomoDisplay = (timerRunning && activeRunningTimerType === "pomodoro") || (!timerRunning && timerType === "pomodoro");
                            const dispSecs = isPomoDisplay
                              ? Math.max(0, pomodoroMinutes * 60 - timerSeconds)
                              : timerSeconds;
                            const t = formatTimerDisplay(dispSecs);
                            return `${t.hrs}h ${t.mins}m ${t.secs}s`;
                          })()}
                        </span>
                      </motion.div>

                      {/* Clean High-Contrast Action Buttons */}
                      <div className="flex items-center justify-center gap-3 w-full max-w-xs mt-2">
                        {timerRunning && activeRunningTimerType !== timerType ? (
                          <button
                            disabled
                            type="button"
                            className="w-full rounded-xl bg-[var(--bg-elevated)] py-2.5 text-xs font-bold text-[var(--text-secondary)] border border-[var(--border)] opacity-50 cursor-not-allowed shadow-xs"
                          >
                            {activeRunningTimerType === "pomodoro" ? "Pomodoro Timer Running..." : "Stopwatch Running..."}
                          </button>
                        ) : (
                          <AnimatePresence mode="wait">
                            {!timerRunning && timerSeconds === 0 ? (
                              <motion.button
                                key="start-clock-btn"
                                type="button"
                                onClick={handleStartTimer}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.94 }}
                                transition={{ type: "spring", stiffness: 300, damping: 14 }}
                                className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 py-2.5 text-xs font-black text-stone-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                              >
                                Start Clock
                              </motion.button>
                            ) : (
                              <motion.div
                                key="active-clock-controls"
                                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="flex items-center gap-2.5 w-full"
                              >
                                <motion.button
                                  type="button"
                                  onClick={timerRunning ? handlePauseTimer : handleStartTimer}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.94 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 14 }}
                                  className="flex-1 rounded-xl py-2.5 px-4 text-xs font-black tracking-wide bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer border border-amber-400/40"
                                >
                                  {timerRunning ? "Pause Clock" : "Resume Clock"}
                                </motion.button>

                                <motion.button
                                  type="button"
                                  onClick={handleResetTimer}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.94 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 14 }}
                                  className="rounded-xl border-2 border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 text-xs font-black tracking-wide text-[var(--text-primary)] hover:text-rose-500 hover:border-rose-500/50 transition-all cursor-pointer shadow-xs"
                                >
                                  Reset
                                </motion.button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-2.5 pt-3.5 border-t border-[var(--border)] w-full mt-auto">
                        <motion.button
                          type="button"
                          onClick={() => setIsLogModalOpen(false)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] cursor-pointer"
                        >
                          Cancel
                        </motion.button>
                        <MicroInteractionButton
                          type="submit"
                          loading={saving}
                          disabled={timerSeconds < 5}
                          className="btn-primary px-5 py-2 text-xs font-extrabold"
                        >
                          Save Session Log
                        </MicroInteractionButton>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.form>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      {/* Floating Draggable Active Running Clock Widget (Emitted when modal closes while clock is running) */}
      {isMounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {timerRunning && !isLogModalOpen && (
            <motion.div
              drag
              dragConstraints={dragBounds}
              dragElastic={0.05}
              dragMomentum={false}
              onMouseEnter={handleFloatingWidgetActivity}
              onMouseMove={handleFloatingWidgetActivity}
              layout
              initial={{ opacity: 0, scale: 0.7, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.7, y: -10 }}
              transition={{
                layout: { type: "spring", stiffness: 240, damping: 24, mass: 0.8 },
                opacity: { duration: 0.2 },
                scale: { type: "spring", stiffness: 280, damping: 24 },
              }}
              className="fixed top-6 right-6 z-[99990] flex flex-col items-center justify-center rounded-3xl border border-amber-500/40 bg-[var(--bg-card)]/95 p-2 shadow-2xl backdrop-blur-2xl cursor-grab active:cursor-grabbing select-none overflow-hidden group"
            >
              <AnimatePresence mode="wait" initial={false}>
                {floatingClockMode === "compact" ? (
                  /* Step 1: Ultra-Compact Mini Floating Clock Disc (Shows live hands + dotted finish hand) */
                  <motion.div
                    key="compact-clock-disc"
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => setFloatingClockMode("medium")}
                    className="relative flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/50 bg-[var(--bg-card)] shadow-lg hover:scale-105 transition-transform cursor-pointer"
                    title="Click to expand clock details"
                  >
                    <svg className="h-full w-full p-1 pointer-events-none" viewBox="0 0 100 100">
                      {/* Mini Perimeter Track */}
                      <circle cx="50" cy="50" r="45" className="stroke-[var(--border)] fill-none" strokeWidth="1.5" />

                      {/* Dotted Finish Target Replica Hands (Hour & Minute) on Smallest Disc */}
                      {activeRunningTimerType === "pomodoro" && pomodoroTargetTimeMs && (() => {
                        const targetDate = new Date(pomodoroTargetTimeMs);
                        const tMin = targetDate.getMinutes();
                        const tHr = (targetDate.getHours() % 12) + tMin / 60;
                        return (
                          <>
                            {/* Dotted Hour Hand (Deep Charcoal Black) */}
                            <g transform={`rotate(${tHr * 30} 50 50)`}>
                              <line x1="48.5" y1="50" x2="48.5" y2="28" className="stroke-neutral-700 dark:stroke-neutral-300" strokeWidth="1.8" strokeDasharray="2 1.5" strokeLinecap="round" />
                              <line x1="51.5" y1="50" x2="51.5" y2="28" className="stroke-neutral-700 dark:stroke-neutral-300" strokeWidth="1.8" strokeDasharray="2 1.5" strokeLinecap="round" />
                              <line x1="48.5" y1="28" x2="51.5" y2="28" className="stroke-neutral-700 dark:stroke-neutral-300" strokeWidth="1.8" strokeDasharray="2 1.5" strokeLinecap="round" />
                            </g>

                            {/* Dotted Minute Hand (Pitch Black) */}
                            <g transform={`rotate(${tMin * 6} 50 50)`}>
                              <line x1="48.5" y1="50" x2="48.5" y2="16" className="stroke-stone-950 dark:stroke-neutral-100" strokeWidth="1.8" strokeDasharray="2.5 1.8" strokeLinecap="round" />
                              <line x1="51.5" y1="50" x2="51.5" y2="16" className="stroke-stone-950 dark:stroke-neutral-100" strokeWidth="1.8" strokeDasharray="2.5 1.8" strokeLinecap="round" />
                              <line x1="48.5" y1="16" x2="51.5" y2="16" className="stroke-stone-950 dark:stroke-neutral-100" strokeWidth="1.8" strokeDasharray="2.5 1.8" strokeLinecap="round" />
                            </g>
                          </>
                        );
                      })()}

                      {/* Live Clock Hands */}
                      {(() => {
                        const curSec = nowDate.getSeconds() + nowDate.getMilliseconds() / 1000;
                        const curMin = nowDate.getMinutes() + curSec / 60;
                        const curHr = (nowDate.getHours() % 12) + curMin / 60;

                        return (
                          <>
                            <line x1="50" y1="50" x2="50" y2="28" className="stroke-amber-400" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${curHr * 30} 50 50)`} />
                            <line x1="50" y1="50" x2="50" y2="18" className="stroke-[var(--text-primary)]" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${curMin * 6} 50 50)`} />
                            <line x1="50" y1="50" x2="50" y2="12" className="stroke-rose-500" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${curSec * 6} 50 50)`} />
                            <circle cx="50" cy="50" r="3" className="fill-rose-500 stroke-[var(--bg-card)]" strokeWidth="1" />
                          </>
                        );
                      })()}
                    </svg>
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                    </span>
                  </motion.div>
                ) : (
                  /* Step 2: Medium Expanded View (Shows readout + quick pause + click to open modal) */
                  <motion.div
                    key="medium-clock-card"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="flex flex-col items-center gap-2 w-full p-1"
                  >
                    {/* Top Drag & Action Bar */}
                    <div
                      onClick={() => setIsLogModalOpen(true)}
                      className="flex items-center justify-between w-full gap-3 px-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                        </span>
                        <span className="text-[10px] font-extrabold tracking-wider uppercase text-amber-400">
                          {activeRunningTimerType === "pomodoro" ? `Pomodoro (${pomodoroMinutes}m)` : "Stopwatch"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFloatingClockMode("compact");
                          }}
                          className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-1 cursor-pointer font-bold"
                          title="Minimize to disc"
                        >
                          —
                        </button>
                        <span className="text-[10px] text-[var(--text-secondary)] opacity-60 group-hover:opacity-100 transition">
                          Expand ↗
                        </span>
                      </div>
                    </div>

                    {/* Mini Analog Clock Dial */}
                    <div
                      onClick={() => setIsLogModalOpen(true)}
                      className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] shadow-inner cursor-pointer"
                    >
                      <svg className="h-full w-full p-1 pointer-events-none" viewBox="0 0 100 100">
                        {/* Mini Perimeter Track */}
                        <circle cx="50" cy="50" r="45" className="stroke-[var(--border)] fill-none" strokeWidth="1.5" />

                        {/* Dotted Finish Target Replica Hands (Hour & Minute) on Medium View */}
                        {activeRunningTimerType === "pomodoro" && pomodoroTargetTimeMs && (() => {
                          const targetDate = new Date(pomodoroTargetTimeMs);
                          const tMin = targetDate.getMinutes();
                          const tHr = (targetDate.getHours() % 12) + tMin / 60;
                          return (
                            <>
                              {/* Dotted Hour Hand (Deep Charcoal Black) */}
                              <g transform={`rotate(${tHr * 30} 50 50)`}>
                                <line x1="48.5" y1="50" x2="48.5" y2="28" className="stroke-neutral-700 dark:stroke-neutral-300" strokeWidth="1.8" strokeDasharray="2 1.5" strokeLinecap="round" />
                                <line x1="51.5" y1="50" x2="51.5" y2="28" className="stroke-neutral-700 dark:stroke-neutral-300" strokeWidth="1.8" strokeDasharray="2 1.5" strokeLinecap="round" />
                                <line x1="48.5" y1="28" x2="51.5" y2="28" className="stroke-neutral-700 dark:stroke-neutral-300" strokeWidth="1.8" strokeDasharray="2 1.5" strokeLinecap="round" />
                              </g>

                              {/* Dotted Minute Hand (Pitch Black) */}
                              <g transform={`rotate(${tMin * 6} 50 50)`}>
                                <line x1="48.5" y1="50" x2="48.5" y2="16" className="stroke-stone-950 dark:stroke-neutral-100" strokeWidth="1.8" strokeDasharray="2.5 1.8" strokeLinecap="round" />
                                <line x1="51.5" y1="50" x2="51.5" y2="16" className="stroke-stone-950 dark:stroke-neutral-100" strokeWidth="1.8" strokeDasharray="2.5 1.8" strokeLinecap="round" />
                                <line x1="48.5" y1="16" x2="51.5" y2="16" className="stroke-stone-950 dark:stroke-neutral-100" strokeWidth="1.8" strokeDasharray="2.5 1.8" strokeLinecap="round" />
                              </g>
                            </>
                          );
                        })()}

                        {/* Live Hands */}
                        {(() => {
                          const curSec = nowDate.getSeconds() + nowDate.getMilliseconds() / 1000;
                          const curMin = nowDate.getMinutes() + curSec / 60;
                          const curHr = (nowDate.getHours() % 12) + curMin / 60;

                          return (
                            <>
                              <line x1="50" y1="50" x2="50" y2="28" className="stroke-amber-400" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${curHr * 30} 50 50)`} />
                              <line x1="50" y1="50" x2="50" y2="18" className="stroke-[var(--text-primary)]" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${curMin * 6} 50 50)`} />
                              <line x1="50" y1="50" x2="50" y2="12" className="stroke-rose-500" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${curSec * 6} 50 50)`} />
                              <circle cx="50" cy="50" r="3" className="fill-rose-500 stroke-[var(--bg-card)]" strokeWidth="1" />
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* Digital Readout & Quick Action Controls */}
                    <div className="flex items-center gap-2 w-full">
                      <div
                        onClick={() => setIsLogModalOpen(true)}
                        className="flex-1 rounded-xl bg-[var(--bg-elevated)] py-1 px-2 text-center cursor-pointer border border-[var(--border)]"
                      >
                        <span className="font-sans text-xs font-extrabold text-[var(--text-primary)]">
                          {(() => {
                            const isPomoDisplay = activeRunningTimerType === "pomodoro";
                            const dispSecs = isPomoDisplay ? Math.max(0, pomodoroMinutes * 60 - timerSeconds) : timerSeconds;
                            const t = formatTimerDisplay(dispSecs);
                            return `${t.hrs > 0 ? t.hrs + "h " : ""}${t.mins}m ${t.secs}s`;
                          })()}
                        </span>
                      </div>

                      {/* Quick Pause / Resume Control */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (timerRunning) {
                            handlePauseTimer();
                          } else {
                            handleStartTimer();
                          }
                        }}
                        className="rounded-xl bg-amber-500 p-1.5 text-stone-950 hover:bg-amber-400 transition cursor-pointer shadow-xs"
                        title="Pause / Resume"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          {timerRunning ? (
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          ) : (
                            <path d="M8 5v14l11-7z" />
                          )}
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}





      {/* Add Custom Subject Modal */}
      {isMounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isAddSubjectModalOpen ? (
            <div
              className="fixed inset-0 z-[99999] flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10 sm:pt-14 pb-16 backdrop-blur-xs"
              onClick={() => setIsAddSubjectModalOpen(false)}
            >
              <motion.form
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onSubmit={handleAddSubject}
                onClick={(e) => e.stopPropagation()}
                className="surface w-full max-w-md space-y-4 p-6 shadow-xl"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                    Subject Manager
                  </span>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">
                    Add Custom Subject
                  </h2>
                </div>

                {/* Subject Name */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Computer Networks"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="app-input w-full px-3.5 py-2 text-sm font-semibold"
                  />
                </div>

                {/* Exam Weightage */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Exam Weightage (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newSubjectWeight}
                    onChange={(e) => setNewSubjectWeight(e.target.value)}
                    className="app-input w-full px-3.5 py-2 text-sm font-semibold"
                  />
                </div>

                {/* Topics / Sub-topics */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">
                    Topics / Sub-topics (comma-separated)
                  </label>
                  <textarea
                    value={newSubjectTopics}
                    onChange={(e) => setNewSubjectTopics(e.target.value)}
                    placeholder="e.g. IP Addressing, TCP/UDP Protocols, Routing Algorithms"
                    className="app-input min-h-[80px] w-full p-3 text-xs"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2.5 pt-2 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => setIsAddSubjectModalOpen(false)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <MicroInteractionButton
                    type="submit"
                    loading={savingSubject}
                    className="btn-primary px-5 py-2 text-xs font-semibold"
                  >
                    Save Subject
                  </MicroInteractionButton>
                </div>
              </motion.form>
            </div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      {/* Delete Subject Confirmation Modal */}
      {isMounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isDeleteSubjectModalOpen && subjectToDelete ? (
            <div
              className="fixed inset-0 z-[99999] grid place-items-center bg-black/40 p-4 backdrop-blur-xs"
              onClick={() => {
                setIsDeleteSubjectModalOpen(false);
                setSubjectToDelete(null);
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={(e) => e.stopPropagation()}
                className="surface w-full max-w-md space-y-4 p-6 shadow-xl border border-rose-500/30"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                    Delete Subject
                  </span>
                  <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--text-primary)]">
                    Delete "{subjectToDelete.subjectName}"?
                  </h2>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    Are you sure you want to delete <strong className="text-[var(--text-primary)]">{subjectToDelete.subjectName}</strong>? This action will remove the subject from your progress tracker database.
                  </p>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeleteSubjectModalOpen(false);
                      setSubjectToDelete(null);
                    }}
                    className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  >
                    Cancel
                  </button>
                  <MicroInteractionButton
                    type="button"
                    loading={deletingSubject}
                    onClick={handleDeleteSubject}
                    className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
                  >
                    Delete Subject
                  </MicroInteractionButton>
                </div>
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}


      {/* Set Custom Daily Goal Modal with Glassmorphic Liquid Drag Capsule */}
      {isMounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isGoalModalOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onMouseDown={(e) => {
                goalModalMouseDownRef.current = e.target === e.currentTarget;
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget && goalModalMouseDownRef.current) {
                  setIsGoalModalOpen(false);
                }
              }}
              className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md"
            >
              <motion.form
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 26,
                  mass: 0.8,
                }}
                onSubmit={handleSaveDailyGoal}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md space-y-5 rounded-3xl border border-stone-200/80 dark:border-white/10 bg-white/95 dark:bg-stone-900/95 p-6 shadow-2xl backdrop-blur-xl text-[var(--text-primary)] relative z-10"
              >
                {/* Glassmorphic Liquid Bar Picker */}
                <GlassmorphicLiquidGoalPicker
                  value={parseFloat(tempGoalInput) || 4.0}
                  onChange={(val) => setTempGoalInput(val.toString())}
                />

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-3 border-t border-stone-200/60 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsGoalModalOpen(false)}
                    className="rounded-xl border border-stone-200 dark:border-white/15 bg-stone-100 dark:bg-stone-800/80 px-4 py-2 text-xs font-semibold text-stone-700 dark:text-stone-300 transition hover:bg-stone-200 dark:hover:bg-stone-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[var(--accent)] px-6 py-2 text-xs font-extrabold text-stone-950 shadow-md shadow-[var(--accent)]/30 hover:brightness-110 transition"
                  >
                    Apply Goal
                  </button>
                </div>
              </motion.form>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}


      {/* 2-Step D1 Logs Clear & Passcode Verification Modal */}
      {isMounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isDeleteModalOpen ? (
            <div
              className="fixed inset-0 z-[99999] grid place-items-center bg-black/40 p-4 backdrop-blur-xs"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={(e) => e.stopPropagation()}
                className="surface w-full max-w-md space-y-4 p-6 shadow-xl border border-rose-500/30"
              >
                {deleteStep === 1 ? (
                  /* Step 1: Confirmation Prompt */
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                        Step 1 of 2 · Danger Zone
                      </span>
                      <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--text-primary)]">
                        Do you still want to delete all tracker logs?
                      </h2>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                        This will permanently erase all recorded study session logs from the Cloudflare D1 database. Other project data (journals, settings) will <strong className="text-[var(--text-primary)]">not</strong> be affected.
                      </p>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setIsDeleteModalOpen(false)}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteStep(2)}
                        className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-600 transition"
                      >
                        Yes, Proceed
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Step 2: Passcode Verification Prompt */
                  <form onSubmit={handleConfirmDeleteWithPasscode} className="space-y-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                        Step 2 of 2 · Security Check
                      </span>
                      <h2 className="mt-1 text-lg font-bold tracking-tight text-[var(--text-primary)]">
                        Enter App Passcode to Confirm
                      </h2>
                      <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                        Please enter your app login passcode to authorize deletion of Cloudflare D1 study tracker logs.
                      </p>
                    </div>

                    <div>
                      <input
                        type="password"
                        autoFocus
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Enter app login passcode"
                        className="app-input w-full px-3.5 py-2.5 text-sm font-semibold"
                      />
                      {passcodeError ? (
                        <p className="mt-2 text-xs font-semibold text-rose-500">{passcodeError}</p>
                      ) : null}
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setIsDeleteModalOpen(false)}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                      >
                        Cancel
                      </button>
                      <MicroInteractionButton
                        type="submit"
                        loading={verifyingPasscode}
                        className="rounded-lg bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 transition"
                      >
                        Delete Logs
                      </MicroInteractionButton>
                    </div>
                  </form>
                )}
              </motion.div>
            </div>
          ) : null}
        </AnimatePresence>,
        document.body
      )}

      {/* Full Session Logs History Modal — Crisp 1-Liner Rows & Chart Table */}
      {isMounted && typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {isLogsHistoryModalOpen ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onMouseDown={(e) => {
                    logsHistoryMouseDownRef.current = e.target === e.currentTarget;
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget && logsHistoryMouseDownRef.current) {
                      setIsLogsHistoryModalOpen(false);
                    }
                  }}
                  className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 6 }}
                    transition={{ type: "spring", stiffness: 450, damping: 32, mass: 0.6 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-xl max-h-[85vh] flex flex-col space-y-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-2xl text-[var(--text-primary)] relative z-[10000] overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <div>
                        <h3 className="text-lg font-black tracking-tight text-[var(--text-primary)]">
                          All Recorded Sessions
                        </h3>
                        <p className="text-xs font-semibold text-[var(--text-secondary)]">
                          {sessionLogs.length} logged {sessionLogs.length === 1 ? "session" : "sessions"} ({formatHumanDuration(totalHours)} total)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsLogsHistoryModalOpen(false)}
                        className="rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--track)] hover:text-[var(--text-primary)] transition"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Date-Wise Collapsible Grouped Views */}
                    <div className="max-h-[60vh] overflow-y-auto space-y-2.5 pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {logsByDateGroups.map((group, groupIdx) => {
                        const isExpanded = expandedDates[group.date] ?? (groupIdx === 0);
                        return (
                          <div
                            key={group.date}
                            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden shadow-xs"
                          >
                            {/* Collapsible Date Header */}
                            <button
                              type="button"
                              onClick={() => toggleDateExpand(group.date)}
                              className="w-full flex items-center justify-between p-3 text-left transition hover:bg-[var(--track)]/50 select-none"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="font-extrabold text-sm text-[var(--text-primary)]">
                                  {formatDisplayDate(group.date)}
                                </span>
                                <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--track)] px-2 py-0.5 rounded-full border border-[var(--border)]/40">
                                  {group.logs.length} {group.logs.length === 1 ? "session" : "sessions"}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-[var(--accent)]">
                                  {formatHumanDuration(group.dayTotalHours)}
                                </span>
                                {group.dayTotalQuestions > 0 && (
                                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                                    · {group.dayTotalQuestions} Qs
                                  </span>
                                )}
                                <motion.svg
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="h-4 w-4 text-[var(--text-secondary)] shrink-0"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.5}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </motion.svg>
                              </div>
                            </button>

                            {/* Expandable Session Rows Table */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="border-t border-[var(--border)] bg-[var(--bg-card)] divide-y divide-[var(--border)]/50"
                                >
                                  {group.logs.map((log) => (
                                    <div
                                      key={log.id}
                                      className="grid grid-cols-12 items-center px-3.5 py-2 text-xs transition hover:bg-[var(--track)]/30"
                                    >
                                      {/* Subject */}
                                      <div className="col-span-5 font-bold text-[var(--text-primary)] truncate">
                                        {log.subjectName}
                                      </div>

                                      {/* Time Block */}
                                      <div className="col-span-3 text-[11px] font-semibold text-[var(--text-secondary)]">
                                        {log.timeBlock || "Session"}
                                      </div>

                                      {/* Hours */}
                                      <div className="col-span-2 text-right font-black text-[var(--accent)]">
                                        {formatHumanDuration(log.hoursStudied)}
                                      </div>

                                      {/* Questions */}
                                      <div className="col-span-2 text-right font-bold text-[var(--text-primary)]">
                                        {log.questionsSolved > 0 ? (
                                          <span>{log.questionsSolved} <span className="text-[10px] text-[var(--text-secondary)]">Qs</span></span>
                                        ) : (
                                          <span className="text-[var(--text-secondary)]">-</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>

                    {/* Close Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setIsLogsHistoryModalOpen(false)}
                        className="rounded-xl bg-[var(--accent)] px-5 py-2 text-xs font-extrabold text-stone-950 shadow-md hover:brightness-110 transition"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </AppShell>

  );
}

function MetricCard({
  label,
  value,
  suffix,
  subtext,
  decimals,
}: {
  label: string;
  value: number;
  suffix: string;
  subtext: string;
  iconType?: "time" | "effort" | "avg" | "questions";
  decimals?: number;
}) {
  return (
    <div className="surface p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
          <AnimatedNumber value={value} decimals={decimals !== undefined ? decimals : Number.isInteger(value) ? 0 : 1} />
          <span className="ml-1.5 text-xs font-semibold text-[var(--text-secondary)]">{suffix}</span>
        </p>
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{subtext}</p>
      </div>
    </div>
  );
}


function GlassmorphicLiquidGoalPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState<number>(value);
  const debounceTimerRef = useRef<number | null>(null);

  // Sync local value with prop when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const minVal = 0.5;
  const maxVal = 14.0;
  const percent = Math.min(Math.max(((localValue - minVal) / (maxVal - minVal)) * 100, 0), 100);

  const updateFromClientX = useCallback(
    (clientX: number, forceImmediate = false) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const rawRatio = relativeX / rect.width;
      const rawVal = minVal + rawRatio * (maxVal - minVal);
      const snapped = Math.round(rawVal * 2) / 2;
      const clamped = Math.min(Math.max(snapped, minVal), maxVal);

      // Instant optimistic local update for 120fps butter-smooth slider
      setLocalValue(clamped);

      if (forceImmediate) {
        if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
        onChange(clamped);
      } else {
        if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = window.setTimeout(() => {
          onChange(clamped);
        }, 40);
      }
    },
    [minVal, maxVal, onChange]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      updateFromClientX(e.clientX);
    };

    const handlePointerUp = (e: PointerEvent) => {
      setIsDragging(false);
      updateFromClientX(e.clientX, true);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, updateFromClientX]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    updateFromClientX(e.clientX);
  };

  return (
    <div className="flex flex-col items-center space-y-4 py-1 select-none">
      {/* High-Contrast Readout */}
      <div className="text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--accent)]">
          Set Goal
        </p>
        <div className="mt-1.5 flex items-baseline justify-center gap-1.5">
          <span className="text-5xl sm:text-6xl font-black tracking-tight text-[var(--accent)] font-sans drop-shadow-xs">
            {localValue.toFixed(1)}
          </span>
          <span className="text-xs font-extrabold text-[var(--text-secondary)]">
            hrs / day
          </span>
        </div>
      </div>

      {/* Glassmorphic Liquid Bar with Scale Labels */}
      <div className="w-full space-y-2">
        {/* Embedded Scale Numbers with Smooth Rounded Font & Brighter Contrast */}
        <div className="flex items-center justify-between px-2 text-[11px] font-bold text-stone-300 dark:text-stone-200 font-sans tracking-wide">
          <span>0.5h</span>
          <span>3h</span>
          <span>6h</span>
          <span>9h</span>
          <span>12h</span>
          <span>14h</span>
        </div>

        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          className="relative h-14 w-full cursor-ew-resize select-none overflow-hidden rounded-2xl border border-stone-300/60 dark:border-white/15 bg-stone-100/80 dark:bg-stone-900/80 backdrop-blur-md p-1.5 shadow-inner touch-none"
        >
          {/* Tick Marks Grid */}
          <div className="absolute inset-0 flex items-center justify-between px-4 opacity-30 pointer-events-none z-10 text-[var(--text-secondary)]">
            {[...Array(15)].map((_, i) => (
              <div key={i} className={`w-0.5 rounded-full bg-current ${i % 2 === 0 ? "h-5" : "h-3"}`} />
            ))}
          </div>

          {/* Butter Smooth Liquid Fill */}
          <div
            className={`relative h-full rounded-xl bg-gradient-to-r from-[var(--accent)]/50 via-[var(--accent)]/90 to-[var(--accent)] shadow-[0_0_20px_rgba(223,177,91,0.5)] flex items-center justify-end pr-1 overflow-hidden ${
              isDragging ? "transition-none" : "transition-[width] duration-150 ease-out"
            }`}
            style={{ width: `${percent}%` }}
          >
            {/* Wave Shimmer Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
            
            {/* Liquid Leading Edge Handle */}
            <div className="h-8 w-2.5 rounded-full bg-white shadow-lg z-20 shrink-0 border border-[var(--accent)]" />
          </div>
        </div>
      </div>

      {/* Drag Guidance */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
        <svg className="w-3.5 h-3.5 text-[var(--accent)] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h8M8 17h8" />
        </svg>
        Drag horizontally across the slider to adjust
      </div>
    </div>
  );
}
