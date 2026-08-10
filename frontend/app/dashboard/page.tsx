"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { toast } from "sonner";
import { AppShell, PageSection } from "@/components/AppShell";
import { AiMarkdown } from "@/components/AiMarkdown";
import { AnimatedNumber, EmptyState, MicroInteractionButton, MotionCard, ProgressBar, StatusBadge } from "@/components/MotionComponents";
import { AnimatePresence, motion } from "motion/react";
import { AiSelection, ModelSelector } from "@/components/ModelSelector";
import { PlanChatModal, CustomTaskTypeDropdown, TASK_CARD_STYLES } from "@/components/PlanChatModal";
import { Latex } from "@/components/Latex";
import { getCache, setCache, clearCache, updateCache } from "@/lib/sessionCache";
import { useDemoFetch } from "@/lib/DemoContext";

function formatPriorityText(text: string): string {
  let cleaned = text;
  // Remove common prefixes
  cleaned = cleaned.replace(/^(Study\s+)?GATE\s+Syllabus\s+Core\s+Topics:\s*(Focus\s+on\s*)?/i, "");
  cleaned = cleaned.replace(/^Focus\s+on\s*/i, "");
  cleaned = cleaned.replace(/^Study\s+Focus\s+on\s*/i, "");
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



export default function Dashboard() {
  const [plan, setPlan] = useState<RoutinePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readiness, setReadiness] = useState(0);
  const [weakArea, setWeakArea] = useState("No weak subject logged yet");
  const [hasAvoidance, setHasAvoidance] = useState(false);
  const [recentlyCompleted, setRecentlyCompleted] = useState<string[]>([]);
  const [manualPlanOpen, setManualPlanOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
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

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || "/api/backend";
  const appFetch = useDemoFetch();

  const fetchTodayPlan = useCallback(async (dateStr?: string, forceRefresh = false) => {
    const queryDate = dateStr || selectedDate;

    if (!forceRefresh) {
      const cached = getCache<{ plan: RoutinePlan | null }>(`routine_plan_${queryDate}`);
      if (cached) {
        setPlan(cached.plan);
        setLoading(false);
        setError("");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await appFetch(`${backendUrl}/api/routine/today?date=${queryDate}`, {
        headers: {},
      });
      if (res.ok) {
        const data = (await res.json()) as RoutinePlan | null;
        setPlan(data);
        setCache(`routine_plan_${queryDate}`, { plan: data });
        setError("");
      } else {
        setPlan(null);
        setCache(`routine_plan_${queryDate}`, { plan: null });
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
    const cached = getCache<TrackerStatus>('tracker_status');
    if (cached) {
      const subjects = Array.isArray(cached.subjects) ? cached.subjects : [];
      setReadiness(cached.overallReadiness || 0);

      const weakSubject =
        subjects.find((subject) => subject.hasAvoidanceWarning) ||
        subjects.find((subject) => subject.isNeglected) ||
        [...subjects].sort((a, b) => (a.latestRating || 5) - (b.latestRating || 5))[0];

      if (weakSubject) {
        setWeakArea(weakSubject.subjectName);
        setHasAvoidance(Boolean(weakSubject.hasAvoidanceWarning || weakSubject.isNeglected));
      }
      return;
    }

    try {
      const res = await appFetch(`${backendUrl}/api/tracker/status`, {
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
      setCache('tracker_status', result);
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
        const response = await appFetch(`${backendUrl}/api/tasks/${taskId}/status`, {
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

    setPlan((currentPlan) => {
      if (!currentPlan) return currentPlan;
      const updatedPlan = {
        ...currentPlan,
        tasks: currentPlan.tasks.map((task) => task.taskId === taskId ? { ...task, status: nextStatus } : task),
      };
      setCache(`routine_plan_${selectedDate}`, { plan: updatedPlan });
      return updatedPlan;
    });
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
      const response = await appFetch(`${backendUrl}/api/routine/plan-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
          draftTasks: planChatDraft,
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
      const response = await appFetch(`${backendUrl}/api/routine/manual?date=${selectedDate}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tasks: planChatDraft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The agreed plan could not be saved.");

      const resultPlan = result as RoutinePlan;
      setPlan(resultPlan);
      setCache(`routine_plan_${selectedDate}`, { plan: resultPlan });
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
      const response = await appFetch(`${backendUrl}/api/routine/manual?date=${selectedDate}`, {
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

      const resultPlan = result as RoutinePlan;
      setPlan(resultPlan);
      setCache(`routine_plan_${selectedDate}`, { plan: resultPlan });
      setManualPlanOpen(false);
      toast.success("Manual plan saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Manual plan could not be saved.");
    } finally {
      setManualPlanSaving(false);
    }
  };

  const handleEditPlan = () => {
    if (!plan || !Array.isArray(plan.tasks)) return;
    const drafts: ManualTaskDraft[] = plan.tasks.map((task) => ({
      id: task.taskId,
      title: task.title,
      taskType: task.taskType,
      durationMin: String(task.durationMin),
    }));
    setManualTasks(drafts);
    setManualPlanOpen(true);
  };

  const handleDeletePlan = () => {
    setDeleteConfirmOpen(true);
  };

  const confirmDeletePlan = async () => {
    setDeletingPlan(true);
    try {
      const res = await appFetch(`${backendUrl}/api/routine/today?date=${selectedDate}`, {
        method: "DELETE",
        headers: {},
      });
      if (res.ok) {
        setPlan(null);
        setCache(`routine_plan_${selectedDate}`, { plan: null });
        toast.success("Plan deleted successfully");
        setDeleteConfirmOpen(false);
      } else {
        toast.error("Failed to delete plan.");
      }
    } catch {
      toast.error("Failed to delete plan.");
    } finally {
      setDeletingPlan(false);
    }
  };

  const score = useMemo(() => {
    const tasks = plan?.tasks;
    if (!plan || !Array.isArray(tasks) || tasks.length === 0) return 0;
    const weights: Record<TaskType, number> = { study: 60, exercise: 15, reading: 10, routine: 15 };
    const groupScore = (taskType: TaskType) => {
      const group = tasks.filter((task) => task.taskType === taskType);
      if (group.length === 0) return 0;
      const completed = group.reduce((sum, task) => sum + taskCompletionRatio(task.status), 0);
      return (completed / group.length) * 100;
    };

    const activeTypes = (Object.keys(weights) as TaskType[]).filter((taskType) =>
      tasks.some((task) => task.taskType === taskType)
    );
    const activeWeight = activeTypes.reduce((total, taskType) => total + weights[taskType], 0);
    if (activeWeight === 0) return 0;

    const earnedScore = activeTypes.reduce(
      (total, taskType) => total + groupScore(taskType) * weights[taskType],
      0
    );
    return Math.round(earnedScore / activeWeight);
  }, [plan]);

  const visibleTasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
  const completedCount = visibleTasks.filter((task) => task.status === "COMPLETED").length;
  const totalMinutes = visibleTasks.reduce((sum, task) => sum + task.durationMin, 0);
  const completedMinutes = visibleTasks.reduce(
    (sum, task) => sum + task.durationMin * taskCompletionRatio(task.status),
    0
  );
  const priority = plan?.mainPriority ? formatPriorityText(plan.mainPriority) : "Generate the AI plan to lock today's priority";
  const taskProgress = visibleTasks.length > 0
    ? (visibleTasks.reduce((sum, task) => sum + taskCompletionRatio(task.status), 0) / visibleTasks.length) * 100
    : 0;
  const timeProgress = totalMinutes > 0 ? (completedMinutes / totalMinutes) * 100 : 0;

  return (
    <AppShell
      eyebrow="Dashboard"
      title="Study day"
      subtitle="Plan, tasks, readiness, and AI help in one compact view."
      actions={
        <>
          <MicroInteractionButton onClick={() => void fetchTodayPlan(selectedDate, true)} className="btn-secondary">
            Refresh
          </MicroInteractionButton>
          {isTodaySelected && (
            <>
              <MicroInteractionButton onClick={() => { if (plan) { handleEditPlan(); } else { setManualPlanOpen(true); } }} className="btn-secondary">
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

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
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
        <MetricTile index={2} label="Tasks" value={completedCount} suffix={plan && Array.isArray(plan.tasks) ? `/${plan.tasks.length}` : "/0"} note="Tap a task to update it" progress={taskProgress} tone="lavender" />
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

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
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
              title="No plan found"
              description={isTodaySelected ? "Generate one or create a manual plan for today." : "No study plan was created for this day."}
              actionLabel={isTodaySelected ? "Plan with AI" : undefined}
              onAction={isTodaySelected ? openPlanChat : undefined}
              loading={loading}
              btnClassName="btn-ai-custom brand-fixed mt-5 shadow-xs"
              className="min-h-[280px]"
            />
          )}
        </PageSection>
      </div>


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
        {deleteConfirmOpen && (
          <ConfirmDeleteModal
            dateText={formatSelectedDate(selectedDate)}
            deleting={deletingPlan}
            onClose={() => setDeleteConfirmOpen(false)}
            onConfirm={() => void confirmDeletePlan()}
          />
        )}
      </AnimatePresence>

      {planChatOpen ? (
        <PlanChatModal
          messages={planChatMessages}
          input={planChatInput}
          suggestions={planChatSuggestions}
          draftTasks={planChatDraft}
          onUpdateDraftTasks={setPlanChatDraft}
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
    const emptyIndex = tasks.findIndex((t) => !t.title.trim());
    if (emptyIndex !== -1) {
      toast.error(`Please enter a title for Task #${emptyIndex + 1} before adding a new task.`);
      return;
    }
    onChange([
      ...tasks,
      {
        id: `task-${Date.now()}`,
        title: "",
        taskType: "study",
        durationMin: "30",
      },
    ]);
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        });
      }
    }, 60);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isOverflowing = el.scrollHeight > el.clientHeight + 10;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 15;
    setCanScrollDown(isOverflowing && !isAtBottom);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => checkScroll());
    observer.observe(el);
    return () => observer.disconnect();
  }, [tasks, checkScroll]);

  useEffect(() => {
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const removeTask = (id: string) => {
    if (tasks.length === 1) return;
    onChange(tasks.filter((task) => task.id !== id));
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const totalMinutes = tasks.reduce((total, task) => total + (Number(task.durationMin) || 0), 0);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(5px)" }}
      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,18,24,0.3)] p-3 overscroll-contain"
      onMouseDown={onClose}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onSubmit={onSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        className="surface flex flex-col h-[80vh] w-full max-w-2xl overflow-hidden p-4 sm:p-5 overscroll-contain"
      >
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-stone-800 font-serif tracking-tight">Create Plan Manually</h2>
            <p className="text-[10px] text-stone-500 font-mono">Custom Daily Study Ledger</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-stone-700 bg-stone-100 border border-stone-200 px-2.5 py-0.5 rounded-full tabular-nums">
              {(totalMinutes / 60).toFixed(1)} hrs ({totalMinutes}m)
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close manual plan"
              className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Capacity Bar */}
        <div className="mt-3 shrink-0">
          <div className="flex items-center justify-between text-[9px] font-semibold text-stone-500 mb-1">
            <span>TOTAL COMMITMENT</span>
            <span className="tabular-nums">{Math.min(100, Math.round((totalMinutes / 480) * 100))}% Capacity</span>
          </div>
          <div className="h-2 w-full bg-stone-100 border border-stone-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-stone-700"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (totalMinutes / 480) * 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <div className="relative flex-1 min-h-0 my-3 flex flex-col">
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex-1 overflow-y-auto overscroll-contain no-scrollbar space-y-2.5 pr-1"
          >
          {tasks.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="group relative flex items-center gap-3 bg-gradient-to-b from-white to-[#FDFCFB] border border-stone-200/90 rounded-2xl p-3.5 shadow-[0_3px_10px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.03)] hover:border-stone-300 hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)] transition-all duration-200"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-100 text-[10px] font-extrabold text-stone-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.04)]">
                {index + 1}
              </span>
              
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <input
                  required
                  type="text"
                  value={task.title}
                  onChange={(event) => updateTask(task.id, { title: event.target.value })}
                  placeholder="Task title..."
                  className="w-full bg-transparent text-xs font-semibold text-stone-800 tracking-tight border-b border-transparent hover:border-stone-200 focus:border-stone-400 focus:bg-stone-50/50 focus:outline-none px-1 py-0.5 rounded-md transition"
                />
                <div className="flex items-center gap-2">
                  <CustomTaskTypeDropdown
                    value={task.taskType}
                    onChange={(val) => updateTask(task.id, { taskType: val })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-stone-100/90 border border-stone-200/90 rounded-full px-3 py-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05),0_1px_0_rgba(255,255,255,0.8)]">
                  <input
                    required
                    type="number"
                    min="5"
                    max="480"
                    step="5"
                    value={task.durationMin}
                    onChange={(event) => updateTask(task.id, { durationMin: event.target.value })}
                    className="w-8 text-xs font-bold text-stone-800 text-center tabular-nums bg-transparent focus:outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="text-[10px] font-bold text-stone-500">m</span>
                </div>

                <button
                  type="button"
                  onClick={() => removeTask(task.id)}
                  disabled={tasks.length === 1}
                  className="opacity-40 group-hover:opacity-100 hover:text-rose-600 hover:bg-rose-50 text-stone-400 p-1.5 rounded-full transition-all cursor-pointer disabled:opacity-20"
                  title="Delete task"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}

          <button
            type="button"
            onClick={addTask}
            disabled={tasks.length >= 30}
            className="w-full py-2.5 border border-dashed border-stone-300/90 hover:border-stone-400 bg-gradient-to-b from-white to-stone-50/70 hover:from-stone-50 hover:to-stone-100/80 text-xs font-bold text-stone-600 hover:text-stone-800 transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer rounded-2xl shadow-[0_2px_6px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-xs mt-3 disabled:opacity-40"
          >
            + Add Custom Task
          </button>
          </div>

          <AnimatePresence>
            {canScrollDown && (
              <motion.button
                type="button"
                onClick={scrollToBottom}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900/90 text-white shadow-lg backdrop-blur-xs transition hover:bg-zinc-950 focus-ring cursor-pointer"
                initial={{ opacity: 0, y: 8, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                aria-label="Scroll to bottom"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="w-4 h-4 text-inherit"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0 0l-4-4m4 4l4-4" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-stone-200 pt-3 shrink-0">
          <button
            type="button"
            onClick={addTask}
            disabled={tasks.length >= 30}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add another task
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-[var(--text-secondary)] mr-2 hidden sm:inline">
              Total: {(totalMinutes / 60).toFixed(1)}h ({totalMinutes}m)
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full font-bold text-xs text-[var(--text-primary)] border border-[var(--border)] bg-white hover:bg-[var(--bg-elevated)] hover:border-[var(--border-strong)] active:scale-[0.98] transition cursor-pointer shadow-2xs"
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
    </motion.div>,
    document.body
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
    <div className="surface p-5 relative">
      {/* Header row — title left, buttons pinned right */}
      <div className="mb-3 border-b border-[var(--border)] pb-3 pr-[170px]">
        <h3 className="line-clamp-2 text-base font-semibold text-[var(--text-primary)]"><Latex text={priority} /></h3>
      </div>

      {/* Edit / Delete — always top-right, never move */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onEditPlan}
          className="focus-ring rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition cursor-pointer whitespace-nowrap"
        >
          Edit Plan
        </button>
        <button
          type="button"
          onClick={onDeletePlan}
          className="focus-ring rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3.5 py-1 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:border-[var(--danger)]/20 transition cursor-pointer whitespace-nowrap"
        >
          Delete Plan
        </button>
      </div>

      <div className="max-h-[400px] space-y-2.5 overflow-y-auto pr-1">
        {(Array.isArray(plan.tasks) ? plan.tasks : []).map((task) => {
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
                  <Latex text={task.title} />
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
    <MotionCard index={index} className={`interactive-surface min-h-[140px] p-4 ${toneClass[tone]}`}>
      <div className="flex h-full flex-col justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
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

function ConfirmDeleteModal({
  dateText,
  deleting,
  onClose,
  onConfirm,
}: {
  dateText: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(5px)" }}
      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
      transition={{ duration: 0.22, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,18,24,0.35)] p-4 overscroll-contain"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onMouseDown={(e) => e.stopPropagation()}
        className="surface w-full max-w-md rounded-2xl border border-[var(--border)] p-6 shadow-2xl bg-[var(--bg-card)]"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
              Delete Routine Plan?
            </h3>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-[var(--text-secondary)]">
              Are you sure you want to delete the plan for <span className="font-semibold text-[var(--text-primary)]">{dateText}</span>? All planned tasks for this day will be removed.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="focus-ring interactive-surface rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="focus-ring flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] px-4 py-2 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
          >
            {deleting ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete Plan</span>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
