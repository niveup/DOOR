"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppShell, PageSection } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { AnimatedNumber, EmptyState, MicroInteractionButton, MotionCard, ProgressBar, StatusBadge } from "@/components/MotionComponents";
import { AiSelection, ModelSelector } from "@/components/ModelSelector";

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
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const fetchTodayPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/routine/today`, {
        headers: { "x-passcode": "1234" },
      });
      if (res.ok) {
        const data = (await res.json()) as RoutinePlan | null;
        setPlan(data);
        setError("");
      } else {
        setError("Today plan could not be loaded.");
      }
    } catch {
      setError("Backend is not reachable. Showing a preview state.");
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  const fetchTrackerStatus = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/tracker/status`, {
        headers: { "x-passcode": "1234" },
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
  }, [fetchTodayPlan, fetchTrackerStatus]);

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
            "x-passcode": "1234",
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
          "x-passcode": "1234",
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
          "x-passcode": "1234",
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
          "x-passcode": "1234",
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
        headers: { "x-passcode": "1234" },
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

  const visibleTasks = plan?.tasks?.length ? plan.tasks : sampleTasks;
  const completedCount = plan?.tasks.filter((task) => task.status === "COMPLETED").length || 0;
  const totalMinutes = visibleTasks.reduce((sum, task) => sum + task.durationMin, 0);
  const completedMinutes = plan?.tasks.reduce(
    (sum, task) => sum + task.durationMin * taskCompletionRatio(task.status),
    0
  ) || 0;
  const priority = plan?.mainPriority || "Generate the AI plan to lock today's priority";
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
          <MicroInteractionButton onClick={fetchTodayPlan} className="btn-secondary">
            Refresh
          </MicroInteractionButton>
          <MicroInteractionButton onClick={() => setManualPlanOpen(true)} className="btn-secondary">
            Create manually
          </MicroInteractionButton>
          <MicroInteractionButton onClick={openPlanChat} className="btn-primary">
            Plan with AI
          </MicroInteractionButton>
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
        <PageSection title="Today's Plan" eyebrow="Routine coach" className="xl:col-span-7">
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
              mark="AI"
              title="No study plan for today"
              description="Generate the AI plan when the backend is running. The preview below keeps the shape visible."
              actionLabel="Plan with AI"
              onAction={openPlanChat}
              loading={loading}
              className="min-h-[280px]"
            />
          )}
        </PageSection>

        <div className="space-y-4 xl:col-span-5">
          <PageSection title="AI Actions" eyebrow="Next move">
            <div className="surface soft-lavender p-4">
              <div className="flex flex-col gap-3 sm:flex-row xl:flex-col 2xl:flex-row">
                <MicroInteractionButton onClick={openPlanChat} className="btn-primary flex-1">
                  Plan with AI
                </MicroInteractionButton>
                <Link href={explainerHref(weakArea)} className="btn-secondary flex-1">
                  Ask AI about weak subject
                </Link>
              </div>
              <p className="mt-3 text-xs font-medium leading-5 text-[var(--text-secondary)]">
                Tell AI what you want to study, compare time options, and approve the draft before anything is saved.
              </p>
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

      {manualPlanOpen ? (
        <ManualPlanModal
          tasks={manualTasks}
          saving={manualPlanSaving}
          onChange={setManualTasks}
          onClose={() => setManualPlanOpen(false)}
          onSubmit={saveManualPlan}
        />
      ) : null}

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

function PlanChatModal({
  messages,
  input,
  suggestions,
  draftTasks,
  ready,
  loading,
  saving,
  aiSelection,
  onInputChange,
  onAiSelectionChange,
  onSend,
  onSuggestion,
  onCreate,
  onClose,
}: {
  messages: PlanChatMessage[];
  input: string;
  suggestions: string[];
  draftTasks: PlanChatTask[];
  ready: boolean;
  loading: boolean;
  saving: boolean;
  aiSelection: AiSelection;
  onInputChange: (value: string) => void;
  onAiSelectionChange: (selection: AiSelection) => void;
  onSend: (event: React.FormEvent) => void;
  onSuggestion: (suggestion: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  const totalMinutes = draftTasks.reduce((total, task) => total + task.durationMin, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(88,104,126,0.18)] p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Plan with AI"
        onMouseDown={(event) => event.stopPropagation()}
        className="surface flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-3.5 sm:px-5">
          <div>
            <p className="section-label mb-1">Collaborative planner</p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Plan with AI</h2>
            <ModelSelector value={aiSelection} onChange={onAiSelectionChange} className="mt-2" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`pill ${ready ? "pill-green" : "pill-blue"}`}>{ready ? "Agreed" : "Discussing"}</span>
            <button type="button" onClick={onClose} aria-label="Close planning chat" title="Close" className="focus-ring grid h-8 w-8 place-items-center rounded-md text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">
              x
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-2.5">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-lg px-3 py-2 text-xs font-medium leading-5 ${
                  message.role === "user"
                    ? "bg-[var(--accent)] text-white"
                    : "border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
                  {[0, 1, 2].map((item) => <span key={item} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />)}
                </div>
              </div>
            ) : null}
          </div>

          {suggestions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={loading}
                  onClick={() => onSuggestion(suggestion)}
                  className="focus-ring rounded-full border border-[var(--border)] bg-white px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          {draftTasks.length > 0 ? (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="section-label">{ready ? "Agreed draft" : "Working draft"}</p>
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{totalMinutes} minutes</span>
              </div>
              <div className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-white">
                {draftTasks.map((task, index) => (
                  <div key={`${task.title}-${index}`} className="grid grid-cols-[22px_1fr_auto] items-center gap-2 px-3 py-2">
                    <span className="text-[10px] font-semibold text-[var(--text-faint)]">{index + 1}</span>
                    <span className="truncate text-xs font-semibold text-[var(--text-primary)]">{task.title}</span>
                    <span className="text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">{task.durationMin}m</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <form onSubmit={onSend} className="border-t border-[var(--border)] bg-white px-4 py-3 sm:px-5">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="Tell AI what to add, remove, or change..."
              disabled={loading}
              className="app-input min-w-0 flex-1 px-3 py-2 text-xs"
            />
            <MicroInteractionButton type="submit" loading={loading} disabled={!input.trim()} className="btn-secondary shrink-0">
              Send
            </MicroInteractionButton>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-medium text-[var(--text-secondary)]">Nothing is saved until you approve the draft.</p>
            {draftTasks.length > 0 ? (
              <MicroInteractionButton type="button" onClick={onCreate} loading={saving} className="btn-primary shrink-0">
                Create this plan
              </MicroInteractionButton>
            ) : null}
          </div>
        </form>
      </div>
    </div>
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
    if (tasks.length >= 8) return;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(88,104,126,0.18)] p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <form
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        className="surface max-h-[90vh] w-full max-w-2xl overflow-y-auto p-4 sm:p-5"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <p className="section-label mb-1.5">Today</p>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Create plan manually</h2>
            <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">The first task becomes today&apos;s priority.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close manual plan" title="Close" className="focus-ring grid h-8 w-8 place-items-center rounded-md text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]">
            x
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {tasks.map((task, index) => (
            <div key={task.id} className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 sm:grid-cols-[24px_minmax(0,1fr)_120px_88px_32px] sm:items-center">
              <span className="text-center text-[11px] font-semibold text-[var(--text-secondary)]">{index + 1}</span>
              <input
                required
                value={task.title}
                onChange={(event) => updateTask(task.id, { title: event.target.value })}
                placeholder="Task name"
                className="app-input bg-white px-3 py-2 text-xs"
              />
              <select
                value={task.taskType}
                onChange={(event) => updateTask(task.id, { taskType: event.target.value as TaskType })}
                className="app-input bg-white px-2 py-2 text-xs"
              >
                <option value="study">Study</option>
                <option value="exercise">Exercise</option>
                <option value="reading">Reading</option>
                <option value="routine">Routine</option>
              </select>
              <label className="relative">
                <input
                  required
                  type="number"
                  min="5"
                  max="480"
                  value={task.durationMin}
                  onChange={(event) => updateTask(task.id, { durationMin: event.target.value })}
                  aria-label={`Minutes for task ${index + 1}`}
                  className="app-input bg-white px-2 py-2 pr-7 text-xs"
                />
                <span className="pointer-events-none absolute right-2 top-2 text-[10px] font-semibold text-[var(--text-faint)]">m</span>
              </label>
              <button
                type="button"
                onClick={() => removeTask(task.id)}
                disabled={tasks.length === 1}
                aria-label={`Remove task ${index + 1}`}
                title="Remove task"
                className="focus-ring grid h-8 w-8 place-items-center rounded-md text-xs font-semibold text-[var(--text-secondary)] hover:bg-white disabled:opacity-30"
              >
                x
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={addTask} disabled={tasks.length >= 8} className="btn-secondary disabled:opacity-40">
            Add task
          </button>
          <span className="text-xs font-semibold text-[var(--text-secondary)]">{totalMinutes} minutes total</span>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <MicroInteractionButton type="submit" loading={saving} className="btn-primary">Save today&apos;s plan</MicroInteractionButton>
        </div>
      </form>
    </div>
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
          <p className="text-xs font-semibold text-[var(--text-secondary)]">{plan.greeting}</p>
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
              className={`focus-ring interactive-surface grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${
                flashed ? "scale-[1.004]" : "scale-100"
              } ${isDone ? "border-[var(--border)] bg-[var(--bg-elevated)]" : "border-[var(--border)] bg-white"}`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-semibold ${
                  isDone
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
                  {task.title}
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
