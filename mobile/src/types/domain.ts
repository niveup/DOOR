export type RoutineStatus = "NOT" | "PARTIAL" | "COMPLETED";
export type FinanceCategory =
  | "Hostel & utilities"
  | "Food & mess"
  | "Travel & commute"
  | "Academics"
  | "Personal & health"
  | "Subscriptions"
  | "Fun & social"
  | "Others";

export type Expense = { id: string; title: string; category: FinanceCategory; amount: number; date: string; payment: "UPI" | "Cash" | "Card" };
export type Bill = { id: string; title: string; category: FinanceCategory; amount: number; date: string; paid: boolean };
export type Budget = { allowance: number; caps: Record<FinanceCategory, number> };
export type FinanceData = { expenses: Expense[]; bills: Bill[]; budget: Budget };

export type RoutineTask = {
  taskId: string;
  title: string;
  taskType: "study" | "exercise" | "reading" | "routine";
  durationMin: number;
  status: RoutineStatus;
  isPriority: boolean;
};
export type RoutinePlan = { planId: string; greeting?: string; mainPriority?: string; totalEstimatedMin?: number; tasks: RoutineTask[] } | null;

export type TrackerSubject = {
  subjectId: number;
  subjectName: string;
  importanceLevel: number;
  latestRating: number | null;
  hoursStudied: number;
  questionsSolved: number;
  cumulativeHours: number;
  cumulativeQuestions: number;
  isNeglected: boolean;
  hasAvoidanceWarning: boolean;
};
export type StudyLog = { id: string; logDate: string; timeBlock: string; subjectId: number; subjectName: string; hoursStudied: number; questionsSolved: number; notes?: string | null };
export type TrackerStatus = { overallReadiness: number; subjects: TrackerSubject[]; logs: StudyLog[]; weeklyAnalysis?: string; dailyAvailableHours: number };

export type JournalEntry = {
  journalId: string;
  date: string | Date;
  entryText: string;
  mood: string | null;
  tags: string[];
  aiFeedback: string | null;
  tomorrowTask: string | null;
  patternDetected: string | null;
};

export const financeCategories: FinanceCategory[] = [
  "Hostel & utilities", "Food & mess", "Travel & commute", "Academics", "Personal & health", "Subscriptions", "Fun & social", "Others",
];
