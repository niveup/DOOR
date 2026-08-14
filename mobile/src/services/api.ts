import { Bill, Budget, Expense, FinanceData, JournalEntry, RoutinePlan, RoutineStatus, TrackerStatus } from "@/src/types/domain";
import { securePasscode } from "@/src/services/secure-store";

const configuredBaseUrl = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 45_000;

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

function apiBaseUrl() {
  if (!configuredBaseUrl) throw new ApiError("Set EXPO_PUBLIC_API_URL before running DOOR.");
  if (!configuredBaseUrl.startsWith("https://") && !__DEV__) throw new ApiError("The production API URL must use HTTPS.");
  return configuredBaseUrl;
}

async function decode<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!response.ok) throw new ApiError(payload.error || payload.message || `Request failed (${response.status}).`, response.status);
  return payload;
}

async function request<T>(path: string, init: RequestInit = {}, passcodeOverride?: string): Promise<T> {
  const passcode = passcodeOverride ?? await securePasscode.read();
  if (!passcode) throw new ApiError("Your passcode is not unlocked.", 401);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "x-passcode": passcode,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
    return decode<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new ApiError("The server took too long to respond. Please try again.");
    throw new ApiError("Could not reach DOOR. Check your internet connection.");
  } finally {
    clearTimeout(timer);
  }
}

type JournalResponse = { entry: JournalEntry | null; feedback?: string; tomorrowTask?: string | null };
type ExplainResponse = { data: unknown; explanationId?: string };

export const api = {
  verifyPasscode: (passcode: string) => request<{ success: true }>("/api/auth/verify", {}, passcode),
  routine: {
    today: (date: string) => request<RoutinePlan>(`/api/routine/today?date=${encodeURIComponent(date)}`),
    generate: () => request<RoutinePlan>("/api/routine/generate", { method: "POST" }),
    updateTask: (taskId: string, status: RoutineStatus) => request<{ task: unknown }>(`/api/routine/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: status === "COMPLETED" ? "completed" : status === "PARTIAL" ? "partial" : "not_completed" }),
    }),
    clear: (date: string) => request<{ success: true }>(`/api/routine/today?date=${encodeURIComponent(date)}`, { method: "DELETE" }),
  },
  finance: {
    get: () => request<FinanceData>("/api/finance/data"),
    saveExpense: (expense: Omit<Expense, "id"> & { id?: string }) => request<{ success: true; expense: Expense }>("/api/finance/expense", { method: "POST", body: JSON.stringify(expense) }),
    deleteExpense: (id: string) => request<{ success: true }>(`/api/finance/expense/${encodeURIComponent(id)}`, { method: "DELETE" }),
    saveBudget: (budget: Budget) => request<{ success: true; budget: Budget }>("/api/finance/budget", { method: "POST", body: JSON.stringify(budget) }),
    saveBill: (bill: Omit<Bill, "id"> & { id?: string }) => request<{ success: true; bill: Bill }>("/api/finance/bill", { method: "POST", body: JSON.stringify(bill) }),
    payBill: (id: string) => request<{ success: true; bill: Bill; expense: Expense }>("/api/finance/bill/pay", { method: "POST", body: JSON.stringify({ id }) }),
    deleteBill: (id: string) => request<{ success: true }>(`/api/finance/bill/${encodeURIComponent(id)}`, { method: "DELETE" }),
  },
  tracker: {
    status: () => request<TrackerStatus>("/api/tracker/status"),
    log: (input: { logDate: string; timeBlock: string; subjectId: number; subjectName: string; hoursStudied: number; questionsSolved: number; notes?: string }) => request<{ success: true; logId: string }>("/api/tracker/log", { method: "POST", body: JSON.stringify(input) }),
    goal: (dailyAvailableHours: number) => request<{ success: true; dailyAvailableHours: number }>("/api/tracker/goal", { method: "POST", body: JSON.stringify({ dailyAvailableHours }) }),
  },
  journal: {
    entry: (date: string) => request<JournalResponse>(`/api/journal/entry?date=${encodeURIComponent(date)}`),
    save: (input: { content: string; mood: string; tags: string[]; date: string }) => request<JournalResponse>("/api/journal/entry", { method: "POST", body: JSON.stringify(input) }),
    history: () => request<{ entries: JournalEntry[] }>("/api/journal/history"),
  },
  explain: (input: { subject?: string; topic?: string; userQuery: string }) => request<ExplainResponse>("/api/explainer/explain", { method: "POST", body: JSON.stringify(input) }),
  interview: (input: { sessionId: string; questionIndex: number; sessionLength: number; company: string; mode: string; question: string; answer: string }) => request<Record<string, unknown>>("/api/interview/evaluate", { method: "POST", body: JSON.stringify(input) }),
};
