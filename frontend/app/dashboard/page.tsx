"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppShell, PageSection } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { AnimatedNumber, EmptyState, MicroInteractionButton, MotionCard, ProgressBar, StatusBadge } from "@/components/MotionComponents";
import { AnimatePresence, motion } from "motion/react";
import { AiSelection, ModelSelector } from "@/components/ModelSelector";
import { PlanChatModal } from "@/components/PlanChatModal";

function cleanMathText(text: string): string {
  return text
    .replace(/\\Delta/gi, "Δ")
    .replace(/\\theta/gi, "θ")
    .replace(/\\sigma/gi, "σ")
    .replace(/\\pi/gi, "π")
    .replace(/\\alpha/gi, "α")
    .replace(/\\beta/gi, "β")
    .replace(/\\gamma/gi, "γ")
    .replace(/\\lambda/gi, "λ")
    .replace(/\\mu/gi, "μ")
    .replace(/\$/g, ""); // Remove math delimiters
}

function formatPriorityText(text: string): string {
  let cleaned = text;
  // Remove common prefixes
  cleaned = cleaned.replace(/^(Study\s+)?GATE\s+Syllabus\s+Core\s+Topics:\s*(Focus\s+on\s*)?/i, "");
  cleaned = cleaned.replace(/^Focus\s+on\s*/i, "");
  cleaned = cleaned.replace(/^Study\s+Focus\s+on\s*/i, "");
  // Strip math symbols
  cleaned = cleanMathText(cleaned);
  // Capitalize first letter
  if (cleaned.length === 0) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

type TaskStatus = "COMPLETED" | "PARTIAL" | "NOT";
type TaskType = "study" | "exercise" | "reading" | "routine";
type Tone = "blue" | "green" | "amber" | "rose" | "teal" | "lavender";

interface Task {
  taskId: string;
  title: string;
  taskType: TaskType;
  durationMin: number;
  status: TaskStatus;
  isPriority: boolean;
}

interface RoutinePlan {
  planId: string;
  greeting: string;
  planText: string;
  mainPriority: string;
  tasks: Task[];
}

interface TrackerSubject {
  subjectId: number;
  subjectName: string;
  latestRating: number | null;
  isNeglected: boolean;
  hasAvoidanceWarning: boolean;
}

interface TrackerStatus {
  overallReadiness: number;
  subjects: TrackerSubject[];
}

interface ManualTaskDraft {
  id: string;
  title: string;
  taskType: TaskType;
  durationMin: string;
}

interface PlanChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

interface PlanChatTask {
  title: string;
  taskType: TaskType;
  durationMin: number;
}

const sampleTasks: Task[] = [
  {
    taskId: "sample-1",
    title: "Revise Thermodynamics entropy numericals",
    taskType: "study",
    durationMin: 90,
    status: "NOT",
    isPriority: true,
  },
  {
    taskId: "sample-2",
    title: "Solve 25 Manufacturing questions",
    taskType: "study",
    durationMin: 75,
    status: "NOT",
    isPriority: false,
  },
  {
    taskId: "sample-3",
    title: "Evening walk and light stretch",
    taskType: "exercise",
    durationMin: 25,
    status: "NOT",
    isPriority: false,
  },
];

const modules = [
  { href: "/journal", mark: "J", title: "Journal", note: "Evening review", tone: "green" },
  { href: "/explainer", mark: "E", title: "Ask AI", note: "Concept help", tone: "blue" },
  { href: "/tracker", mark: "T", title: "Tracker", note: "Subject ratings", tone: "amber" },
  { href: "/interview", mark: "I", title: "Interview", note: "PSU practice", tone: "lavender" },
] as const;

const toneClass: Record<Tone, string> = {
  blue: "soft-blue",
  green: "soft-mint",
  amber: "soft-sun",
  rose: "bg-[var(--danger-soft)]",
  teal: "soft-mint",
  lavender: "soft-lavender",
};

function taskStatusLabel(status: TaskStatus) {
  if (status === "COMPLETED") return "Done";
  if (status === "PARTIAL") return "Partial";
  return "Open";
}

function taskCompletionRatio(status: TaskStatus) {
  if (status === "COMPLETED") return 1;
  if (status === "PARTIAL") return 0.5;
  return 0;
}

function scoreBand(score: number) {
  if (score >= 75) return "Good pace";
  if (score >= 50) return "Needs one clear push";
  return "Keep it small and restart";
}

function taskTypeLabel(taskType: TaskType) {
  if (taskType === "study") return "Study";
  if (taskType === "exercise") return "Exercise";
  if (taskType === "reading") return "Reading";
  return "Routine";
}

function explainerHref(topic: string) {
  const safeTopic = topic && !topic.toLowerCase().includes("no weak") ? topic : "Thermodynamics";
  return `/explainer?topic=${encodeURIComponent(safeTopic)}`;
}

export default function Dashboard() {
  const [plan, setPlan] = useState<RoutinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readiness, setReadiness] = useState(0);
  const [weakArea, setWeakArea] = useState("No weak subject logged yet");
  const [hasAvoidance, setHasAvoidance] = useState(false);
  const [recentlyCompleted, setRecentlyCompleted] = useState<string[]>([]);
  const [manualPlanOpen, setManualPlanOpen] = useState(false);
  const [manualPlanSaving, setManualPlanSaving] = useState(false);
  const [manualTasks, setManualTasks] = useState<ManualTaskDraft[]>([
    { id: "task-1", title: "", taskType: "study", durationMin: "45" },
  ]);
  const [planChatOpen, setPlanChatOpen] = useState(false);
  const [planChatMessages, setPlanChatMessages] = useState<PlanChatMessage[]>([]);
  const [planChatInput, setPlanChatInput] = useState("");
  const [planChatSuggestions, setPlanChatSuggestions] = useState<string[]>([]);
  const [planChatDraft, setPlanChatDraft] = useState<PlanChatTask[]>([]);
  const [planChatReady, setPlanChatReady] = useState(false);
  const [planChatLoading, setPlanChatLoading] = useState(false);
  const [planChatSaving, setPlanChatSaving] = useState(false);
  const [planChatAi, setPlanChatAi] = useState<AiSelection>({
    provider: "nvidia",
    model: "meta/llama-3.1-8b-instruct",
  });
  const pendingTaskStatuses = useRef(new Map<string, TaskStatus>());
  const taskSaveTimers = useRef(new Map<string, number>());
  const taskSavesInFlight = useRef(new Set<string>());
  const getTodayKolkataDateString = () => {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = useMemo(() => getTodayKolkataDateString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const isTodaySelected = selectedDate === todayStr;

  const formatSelectedDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const fetchTodayPlan = useCallback(async (dateStr?: string) => {
    setLoading(true);
    try {
      const queryDate = dateStr || selectedDate;
      const res = await fetch(`${backendUrl}/api/routine/today?date=${queryDate}`, {
        headers: {},
      });
      if (res.ok) {
        const data = (await res.json()) as RoutinePlan | null;
        setPlan(data);
        setError("");
      } else {
        setPlan(null);
        setError("Plan could not be loaded.");
      }
    } catch {
      setPlan(null);
      setError("Backend is not reachable. Showing a preview state.");
    } finally {
      setLoading(false);
    }
  }, [backendUrl, selectedDate]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    void fetchTodayPlan(newDate);
  };

  const fetchTrackerStatus = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/tracker/status`, {
        headers: {},
      });
      if (!res.ok) return;
      const result = (await res.json()) as TrackerStatus;
      const subjects = Array.isArray(result.subjects) ? result.subjects : [];
      setReadiness(result.overallReadiness || 0);

      const weakSubject =
        subjects.find((subject) => subject.hasAvoidanceWarning) ||
        subjects.find((subject) => subject.isNeglected) ||
        [...subjects].sort((a, b) => (a.latestRating || 5) - (b.latestRating || 5))[0];

      if (weakSubject) {
        setWeakArea(weakSubject.subjectName);
        setHasAvoidance(Boolean(weakSubject.hasAvoidanceWarning || weakSubject.isNeglected));
      }
    } catch {
      setWeakArea("Tracker appears after the backend starts");
    }
  }, [backendUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchTodayPlan();
      void fetchTrackerStatus();
    }, 0);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timers = taskSaveTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const persistTaskStatus = useCallback(async (taskId: string) => {
    if (taskSavesInFlight.current.has(taskId)) return;
    taskSavesInFlight.current.add(taskId);

    try {
      while (pendingTaskStatuses.current.has(taskId)) {
        const status = pendingTaskStatuses.current.get(taskId);
        pendingTaskStatuses.current.delete(taskId);
        const response = await fetch(`${backendUrl}/api/tasks/${taskId}/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error("Task status could not be saved.");
      }
    } catch {
      setError("The task changed here, but the server could not save it. Tap it once more to retry.");
    } finally {
      taskSavesInFlight.current.delete(taskId);
    }
  }, [backendUrl]);

  const handleToggleTask = (taskId: string, currentStatus: TaskStatus) => {
    const nextStatus: TaskStatus = currentStatus === "NOT" ? "PARTIAL" : currentStatus === "PARTIAL" ? "COMPLETED" : "NOT";

    setPlan((currentPlan) => currentPlan
      ? {
        ...currentPlan,
        tasks: currentPlan.tasks.map((task) => task.taskId === taskId ? { ...task, status: nextStatus } : task),
      }
      : currentPlan
    );
    setError("");

    if (nextStatus === "COMPLETED") {
      setRecentlyCompleted((prev) => [...prev, taskId]);
      window.setTimeout(() => {
        setRecentlyCompleted((prev) => prev.filter((id) => id !== taskId));
      }, 650);
    }

    pendingTaskStatuses.current.set(taskId, nextStatus);
    const existingTimer = taskSaveTimers.current.get(taskId);
    if (existingTimer) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      taskSaveTimers.current.delete(taskId);
      void persistTaskStatus(taskId);
    }, 40);
    taskSaveTimers.current.set(taskId, timer);
  };

  const openPlanChat = () => {
    setPlanChatMessages([
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "What do you want to accomplish today? Tell me the subject or task first, then I will suggest a few realistic time options.",
      },
    ]);
    setPlanChatInput("");
    setPlanChatSuggestions(["One focused subject", "Revision and questions", "A mixed study day"]);
    setPlanChatDraft([]);
    setPlanChatReady(false);
    setPlanChatOpen(true);
  };

  const sendPlanChatMessage = async (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent || planChatLoading) return;

    const userMessage: PlanChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedContent,
    };
    const nextMessages = [...planChatMessages, userMessage];
    setPlanChatMessages(nextMessages);
    setPlanChatInput("");
    setPlanChatSuggestions([]);
    setPlanChatLoading(true);

    try {
      const response = await fetch(`${backendUrl}/api/routine/plan-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
          aiProvider: planChatAi.provider,
          aiModel: planChatAi.model,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The planning chat could not continue.");

      setPlanChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.reply || "What would you like to adjust?",
        },
      ]);
      setPlanChatSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
      setPlanChatDraft(Array.isArray(result.draftTasks) ? result.draftTasks : []);
      setPlanChatReady(Boolean(result.ready));
    } catch (chatError) {
      setPlanChatMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: chatError instanceof Error ? chatError.message : "The planning chat could not continue.",
        },
      ]);
    } finally {
      setPlanChatLoading(false);
    }
  };

  const handlePlanChatSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void sendPlanChatMessage(planChatInput);
  };

  const createPlanFromChat = async () => {
    if (planChatDraft.length === 0) return;
    setPlanChatSaving(true);
    try {
      const response = await fetch(`${backendUrl}/api/routine/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tasks: planChatDraft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The agreed plan could not be saved.");

      setPlan(result as RoutinePlan);
      setPlanChatOpen(false);
      toast.success("Your agreed plan is ready");
    } catch (chatSaveError) {
      setPlanChatMessages((current) => [
        ...current,
        {
          id: `assistant-save-error-${Date.now()}`,
          role: "assistant",
          content: chatSaveError instanceof Error ? chatSaveError.message : "The agreed plan could not be saved.",
        },
      ]);
    } finally {
      setPlanChatSaving(false);
    }
  };

  const saveManualPlan = async (event: React.FormEvent) => {
    event.preventDefault();
    setManualPlanSaving(true);
    setError("");
    try {
      const response = await fetch(`${backendUrl}/api/routine/manual`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tasks: manualTasks.map((task) => ({
            title: task.title,
            taskType: task.taskType,
            durationMin: Number(task.durationMin),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Manual plan could not be saved.");

      setPlan(result as RoutinePlan);
      setManualPlanOpen(false);
      toast.success("Manual plan saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Manual plan could not be saved.");
    } finally {
      setManualPlanSaving(false);
    }
  };

  const handleEditPlan = () => {
    if (!plan) return;
    const drafts: ManualTaskDraft[] = plan.tasks.map((task) => ({
      id: task.taskId,
      title: task.title,
      taskType: task.taskType,
      durationMin: String(task.durationMin),
    }));
    setManualTasks(drafts);
    setManualPlanOpen(true);
  };

  const handleDeletePlan = async () => {
    if (!confirm("Are you sure you want to delete today's plan?")) return;
    try {
      const res = await fetch(`${backendUrl}/api/routine/today`, {
        method: "DELETE",
        headers: {},
      });
      if (res.ok) {
        setPlan(null);
        toast.success("Today's plan deleted");
      } else {
        toast.error("Failed to delete today's plan.");
      }
    } catch {
      toast.error("Failed to delete today's plan.");
    }
  };

  const score = useMemo(() => {
    if (!plan || plan.tasks.length === 0) return 0;
    const weights: Record<TaskType, number> = { study: 60, exercise: 15, reading: 10, routine: 15 };
    const groupScore = (taskType: TaskType) => {
      const group = plan.tasks.filter((task) => task.taskType === taskType);
      if (group.length === 0) return 0;
      const completed = group.reduce((sum, task) => sum + taskCompletionRatio(task.status), 0);
      return (completed / group.length) * 100;
    };

    const activeTypes = (Object.keys(weights) as TaskType[]).filter((taskType) =>
      plan.tasks.some((task) => task.taskType === taskType)
    );
    const activeWeight = activeTypes.reduce((total, taskType) => total + weights[taskType], 0);
    if (activeWeight === 0) return 0;

    const earnedScore = activeTypes.reduce(
      (total, taskType) => total + groupScore(taskType) * weights[taskType],
      0
    );
    return Math.round(earnedScore / activeWeight);
  }, [plan]);

  const visibleTasks = plan?.tasks || [];
  const completedCount = plan?.tasks.filter((task) => task.status === "COMPLETED").length || 0;
  const totalMinutes = visibleTasks.reduce((sum, task) => sum + task.durationMin, 0);
  const completedMinutes = plan?.tasks.reduce(
    (sum, task) => sum + task.durationMin * taskCompletionRatio(task.status),
    0
  ) || 0;
  const priority = plan?.mainPriority ? formatPriorityText(plan.mainPriority) : "Generate the AI plan to lock today's priority";
  const taskProgress = plan?.tasks.length
    ? (plan.tasks.reduce((sum, task) => sum + taskCompletionRatio(task.status), 0) / plan.tasks.length) * 100
    : 0;
  const timeProgress = totalMinutes > 0 ? (completedMinutes / totalMinutes) * 100 : 0;

  return (
    <AppShell
      eyebrow="Dashboard"
      title="Study day"
      subtitle="Plan, tasks, readiness, and AI help in one compact view."
      actions={
        <>
          <MicroInteractionButton onClick={() => void fetchTodayPlan()} className="btn-secondary">
            Refresh
          </MicroInteractionButton>
          {isTodaySelected && (
            <>
              <MicroInteractionButton onClick={() => setManualPlanOpen(true)} className="btn-secondary">
                Create manually
              </MicroInteractionButton>
              <span className="btn-ai-wrapper">
                <MicroInteractionButton onClick={openPlanChat} className="btn-ai-custom brand-fixed shadow-xs group">
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    <svg className="h-4 w-4 text-amber-500 transition-transform duration-500 ease-out group-hover:rotate-90" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" />
                    </svg>
                  </span>
                  <span className="btn-text-slide">Plan with AI</span>
                </MicroInteractionButton>
              </span>
            </>
          )}
        </>
      }
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-4 py-3 text-xs font-semibold text-[var(--warning)]">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricTile index={0} label="Readiness" value={readiness} suffix="%" note={weakArea} progress={readiness} tone={hasAvoidance ? "amber" : "green"} />
        <MetricTile
          index={1}
          label="Today score"
          value={plan ? score : 0}
          suffix="/100"
          note={plan ? (score === 0 ? "Starts when a task moves" : scoreBand(score)) : "Waiting for plan"}
          progress={plan ? score : 0}
          tone="blue"
        />
        <MetricTile index={2} label="Tasks" value={completedCount} suffix={plan ? `/${plan.tasks.length}` : "/0"} note="Tap a task to update it" progress={taskProgress} tone="lavender" />
        <MetricTile
          index={3}
          label="Time done"
          value={Math.round(completedMinutes)}
          suffix={`/${totalMinutes}m`}
          note={completedMinutes >= totalMinutes && totalMinutes > 0 ? "All planned time complete" : `${Math.max(0, Math.round(totalMinutes - completedMinutes))}m remaining`}
          progress={timeProgress}
          tone="amber"
        />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <PageSection
          title={isTodaySelected ? "Today's Plan" : `${formatSelectedDate(selectedDate)}'s Plan`}
          eyebrow={isTodaySelected ? "Routine coach" : "Plan history"}
          className="xl:col-span-7"
          action={
            <div className="flex items-center gap-2">
              <label htmlFor="plan-date-select" className="sr-only">Choose Date</label>
              <input
                id="plan-date-select"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="focus-ring rounded-full border border-[var(--border)] bg-white px-3.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition cursor-pointer"
              />
            </div>
          }
        >
          {loading ? (
            <div className="surface p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-36 rounded bg-[var(--track)]" />
                <div className="h-12 rounded bg-[var(--track)]" />
                <div className="h-10 rounded bg-[var(--track)]" />
                <div className="h-10 rounded bg-[var(--track)]" />
              </div>
            </div>
          ) : plan ? (
            <PlanPanel
              plan={plan}
              priority={priority}
              score={score}
              recentlyCompleted={recentlyCompleted}
              onToggleTask={handleToggleTask}
              onEditPlan={handleEditPlan}
              onDeletePlan={handleDeletePlan}
            />
          ) : (
            <EmptyState
              title={isTodaySelected ? "No study plan for today" : "No study plan was created for this day"}
              actionLabel={isTodaySelected ? "Plan with AI" : undefined}
              onAction={isTodaySelected ? openPlanChat : undefined}
              loading={loading}
              btnClassName="btn-ai-custom brand-fixed mt-5 shadow-xs"
              className="min-h-[280px]"
            />
          )}
        </PageSection>

        <div className="space-y-4 xl:col-span-5">
          <PageSection title="AI Actions" eyebrow="Next move">
            <div className="surface soft-lavender p-4">
              <div className="flex flex-col gap-3 sm:flex-row xl:flex-col 2xl:flex-row">
                <span className="btn-ai-wrapper flex-1">
                  <MicroInteractionButton onClick={openPlanChat} className="btn-ai-custom brand-fixed w-full shadow-xs group">
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      <svg className="h-4 w-4 text-amber-500 transition-transform duration-500 ease-out group-hover:rotate-90" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" />
                      </svg>
                    </span>
                    <span className="btn-text-slide">Plan with AI</span>
                  </MicroInteractionButton>
                </span>
                <Link href={explainerHref(weakArea)} className="btn-secondary flex-1">
                  Ask AI about weak subject
                </Link>
              </div>
            </div>
          </PageSection>

          <PageSection title="Focus Signal" eyebrow="Tracker">
            <div className="surface p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">Weak subject</p>
                  <h3 className="mt-1 line-clamp-2 text-base font-semibold text-[var(--text-primary)]">{weakArea}</h3>
                </div>
                <StatusBadge label={hasAvoidance ? "Avoided" : "Current"} tone={hasAvoidance ? "amber" : "green"} />
              </div>
              <ProgressBar value={readiness} tone={hasAvoidance ? "amber" : "green"} />
              <p className="mt-3 text-xs font-medium leading-5 text-[var(--text-secondary)]">
                {hasAvoidance ? "Give this one direct attention this week." : "Based on the latest tracker status."}
              </p>
            </div>
          </PageSection>

          <PageSection title="Plan Maker" eyebrow="Easy start">
            <div className="surface soft-blue p-4">
              <div className="grid gap-2">
                <Link href="/journal" className="interactive-surface rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                  Write entry
                </Link>
                <button
                  type="button"
                  onClick={() => setManualPlanOpen(true)}
                  className="focus-ring interactive-surface rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)]"
                >
                  Create plan manually
                </button>
              </div>
            </div>
          </PageSection>
        </div>
      </div>

      <PageSection title="Study Tools" eyebrow="Shortcuts" className="mt-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {modules.map((module, index) => (
            <Link key={module.href} href={module.href} className="block">
              <MotionCard index={index} className={`interactive-surface h-full p-3 ${toneClass[module.tone]}`}>
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/75 text-xs font-semibold text-[var(--text-primary)]">
                    {module.mark}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{module.title}</span>
                    <span className="block truncate text-[11px] font-medium text-[var(--text-secondary)]">{module.note}</span>
                  </span>
                </div>
              </MotionCard>
            </Link>
          ))}
        </div>
      </PageSection>

      <AnimatePresence>
        {manualPlanOpen && (
          <ManualPlanModal
            tasks={manualTasks}
            saving={manualPlanSaving}
            onChange={setManualTasks}
            onClose={() => setManualPlanOpen(false)}
            onSubmit={saveManualPlan}
          />
        )}
      </AnimatePresence>

      {planChatOpen ? (
        <PlanChatModal
          messages={planChatMessages}
          input={planChatInput}
          suggestions={planChatSuggestions}
          draftTasks={planChatDraft}
          ready={planChatReady}
          loading={planChatLoading}
          saving={planChatSaving}
          aiSelection={planChatAi}
          onInputChange={setPlanChatInput}
          onAiSelectionChange={setPlanChatAi}
          onSend={handlePlanChatSubmit}
          onSuggestion={(suggestion) => void sendPlanChatMessage(suggestion)}
          onCreate={() => void createPlanFromChat()}
          onClose={() => setPlanChatOpen(false)}
        />
      ) : null}
    </AppShell>
  );
}

function ManualPlanModal({
  tasks,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  tasks: ManualTaskDraft[];
  saving: boolean;
  onChange: (tasks: ManualTaskDraft[]) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const updateTask = (id: string, patch: Partial<ManualTaskDraft>) => {
    onChange(tasks.map((task) => task.id === id ? { ...task, ...patch } : task));
  };

  const addTask = () => {
    if (tasks.length >= 30) return;
    onChange([
      ...tasks,
      {
        id: `task-${Date.now()}`,
        title: "",
        taskType: "study",
        durationMin: "30",
      },
    ]);
  };

  const removeTask = (id: string) => {
    if (tasks.length === 1) return;
    onChange(tasks.filter((task) => task.id !== id));
  };

  const totalMinutes = tasks.reduce((total, task) => total + (Number(task.durationMin) || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(5px)" }}
      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,18,24,0.3)] p-3"
      onMouseDown={onClose}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        className="surface flex flex-col h-[80vh] w-full max-w-2xl overflow-hidden p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Create plan manually</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close manual plan"
            title="Close"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar my-4 space-y-2.5 pr-1">
          {tasks.map((task, index) => (
            <div key={task.id} className="grid grid-cols-[24px_1fr] gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 sm:grid-cols-[24px_minmax(0,1fr)_120px_88px_32px] sm:items-center">
              <span className="text-center text-[11px] font-semibold text-[var(--text-secondary)]">{index + 1}</span>
              <input
                required
                value={task.title}
                onChange={(event) => updateTask(task.id, { title: event.target.value })}
                placeholder="Task name"
                className="app-input rounded-full bg-white px-4 py-1.5 text-xs border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition"
              />
              <select
                value={task.taskType}
                onChange={(event) => updateTask(task.id, { taskType: event.target.value as TaskType })}
                className="app-input rounded-full bg-white px-3 py-1.5 text-xs border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition cursor-pointer"
              >
                <option value="study">Study</option>
                <option value="exercise">Exercise</option>
                <option value="reading">Reading</option>
                <option value="routine">Routine</option>
              </select>
              <label className="relative block">
                <input
                  required
                  type="number"
                  min="5"
                  max="480"
                  value={task.durationMin}
                  onChange={(event) => updateTask(task.id, { durationMin: event.target.value })}
                  aria-label={`Minutes for task ${index + 1}`}
                  className="app-input rounded-full bg-white px-4 py-1.5 pr-8 text-xs font-semibold border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition"
                />
                <span className="pointer-events-none absolute right-3.5 top-1.5 text-[10px] font-semibold text-[var(--text-faint)]">m</span>
              </label>
              <button
                type="button"
                onClick={() => removeTask(task.id)}
                disabled={tasks.length === 1}
                aria-label={`Remove task ${index + 1}`}
                title="Remove task"
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:opacity-30 transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={addTask}
              disabled={tasks.length >= 30}
              className="px-4 py-2 rounded-full font-bold text-xs border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition disabled:opacity-40 cursor-pointer"
            >
              Add task
            </button>
            <span className="text-xs font-semibold text-[var(--text-secondary)]">{totalMinutes} minutes total</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full font-bold text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] hover:bg-[var(--border)] transition cursor-pointer"
            >
              Cancel
            </button>
            <MicroInteractionButton
              type="submit"
              loading={saving}
              className="px-5 py-2.5 rounded-full font-bold text-xs text-white bg-zinc-900 hover:bg-zinc-950 transition cursor-pointer shadow-sm active:scale-[0.98] flex items-center justify-center gap-1.5"
            >
              Save today&apos;s plan
            </MicroInteractionButton>
          </div>
        </div>
      </motion.form>
    </motion.div>
  );
}

const PlanPanel = memo(function PlanPanel({
  plan,
  priority,
  score,
  recentlyCompleted,
  onToggleTask,
  onEditPlan,
  onDeletePlan,
}: {
  plan: RoutinePlan;
  priority: string;
  score: number;
  recentlyCompleted: string[];
  onToggleTask: (taskId: string, currentStatus: TaskStatus) => void;
  onEditPlan: () => void;
  onDeletePlan: () => void;
}) {
  return (
    <div className="surface p-4">
      <div className="mb-3 flex flex-col justify-between gap-3 border-b border-[var(--border)] pb-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h3 className="mt-1 line-clamp-2 text-base font-semibold text-[var(--text-primary)]">{priority}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEditPlan}
            className="focus-ring rounded-lg border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition cursor-pointer"
          >
            Edit Plan
          </button>
          <button
            type="button"
            onClick={onDeletePlan}
            className="focus-ring rounded-lg border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] transition cursor-pointer"
          >
            Delete Plan
          </button>
          <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            {scoreBand(score)}
          </span>
        </div>
      </div>

      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {plan.tasks.map((task) => {
          const isDone = task.status === "COMPLETED";
          const isPartial = task.status === "PARTIAL";
          const flashed = recentlyCompleted.includes(task.taskId);
          return (
            <button
              key={task.taskId}
              type="button"
              onClick={() => onToggleTask(task.taskId, task.status)}
              className={`focus-ring interactive-surface grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${flashed ? "scale-[1.004]" : "scale-100"
                } ${isDone ? "border-[var(--border)] bg-[var(--bg-elevated)]" : "border-[var(--border)] bg-white"}`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold ${isDone
                  ? "border-[var(--success)] bg-[var(--success)] text-white"
                  : isPartial
                    ? "border-[var(--sun)] bg-[var(--sun-soft)] text-[var(--sun)]"
                    : task.isPriority
                      ? "border-[var(--sun)] bg-[var(--sun-soft)] text-[var(--sun)]"
                      : "border-[var(--border-strong)] bg-white text-[var(--text-secondary)]"
                  }`}
              >
                {isDone ? "OK" : isPartial ? "50" : "0"}
              </span>
              <span className="min-w-0">
                <span className={`block truncate text-xs font-semibold ${isDone ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}>
                  {cleanMathText(task.title)}
                </span>
                <span className="mt-1 block truncate text-[10px] font-medium text-[var(--text-secondary)]">
                  {taskTypeLabel(task.taskType)} / {taskStatusLabel(task.status)} / tap for next step
                </span>
              </span>
              <span className="text-xs font-medium tabular-nums text-[var(--text-secondary)]">{task.durationMin}m</span>
            </button>
          );
        })}
      </div>

      <details className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-[var(--text-primary)]">Coach note</summary>
        <div className="mt-2 border-t border-[var(--border)] pt-2">
          <AiMarkdown content={plan.planText} />
        </div>
      </details>
    </div>
  );
});

const MetricTile = memo(function MetricTile({
  index,
  label,
  value,
  suffix,
  note,
  progress,
  tone,
}: {
  index: number;
  label: string;
  value: number;
  suffix: string;
  note: string;
  progress: number;
  tone: Tone;
}) {
  const progressTone = tone === "lavender" ? "blue" : tone === "rose" ? "rose" : tone === "amber" ? "amber" : tone === "teal" ? "teal" : tone === "green" ? "green" : "blue";

  return (
    <MotionCard index={index} className={`interactive-surface min-h-[128px] p-3 ${toneClass[tone]}`}>
      <div className="flex h-full flex-col justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            <AnimatedNumber value={value} instant />
            <span className="ml-1 text-xs font-medium text-[var(--text-secondary)]">{suffix}</span>
          </p>
        </div>
        <div>
          <p className="mb-2 line-clamp-1 text-[11px] font-medium text-[var(--text-secondary)]">{note}</p>
          <ProgressBar value={progress} tone={progressTone} />
        </div>
      </div>
    </MotionCard>
  );
});
