"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";

type Category =
  | "Hostel & utilities"
  | "Food & mess"
  | "Travel & commute"
  | "Academics"
  | "Personal & health"
  | "Subscriptions"
  | "Fun & social"
  | "Others";

type Expense = {
  id: string;
  title: string;
  category: Category;
  amount: number;
  date: string;
  payment: "UPI" | "Cash" | "Card";
};

const categoryMeta: Record<Category, { icon: IconName; color: string; soft: string; budget: number }> = {
  "Hostel & utilities": { icon: "building", color: "var(--lavender)", soft: "var(--lavender-soft)", budget: 0 },
  "Food & mess": { icon: "utensils", color: "var(--sun)", soft: "var(--sun-soft)", budget: 0 },
  "Travel & commute": { icon: "train", color: "var(--teal)", soft: "var(--teal-soft)", budget: 0 },
  Academics: { icon: "book", color: "var(--mint)", soft: "var(--mint-soft)", budget: 0 },
  "Personal & health": { icon: "heart", color: "var(--danger)", soft: "var(--danger-soft)", budget: 0 },
  Subscriptions: { icon: "phone", color: "var(--accent)", soft: "var(--accent-soft)", budget: 0 },
  "Fun & social": { icon: "users", color: "var(--lavender)", soft: "var(--lavender-soft)", budget: 0 },
  Others: { icon: "more", color: "var(--text-secondary)", soft: "var(--bg-elevated)", budget: 0 },
};

const categoryOrder = Object.keys(categoryMeta) as Category[];

type BudgetPlan = {
  allowance: number;
  caps: Record<Category, number>;
};

type Bill = {
  id: string;
  title: string;
  date: string;
  amount: number;
  category: Category;
  paid: boolean;
};

const defaultBudgetPlan: BudgetPlan = {
  allowance: 0,
  caps: {
    "Hostel & utilities": 0,
    "Food & mess": 0,
    "Travel & commute": 0,
    Academics: 0,
    "Personal & health": 0,
    Subscriptions: 0,
    "Fun & social": 0,
    Others: 0,
  },
};

type IconName =
  | "arrow"
  | "book"
  | "building"
  | "calendar"
  | "card"
  | "check"
  | "chevron"
  | "coffee"
  | "download"
  | "edit"
  | "filter"
  | "friends"
  | "heart"
  | "lightning"
  | "more"
  | "phone"
  | "plus"
  | "receipt"
  | "search"
  | "sparkles"
  | "train"
  | "trash"
  | "trend"
  | "users"
  | "utensils"
  | "wallet";

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = {
    fill: "none",
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  if (name === "users" || name === "friends")
    return (
      <svg {...common}>
        <circle cx="12" cy="7" r="2.8" />
        <path d="M10.2 7.2a1.8 1.8 0 0 0 3.6 0" />
        <path d="M7.5 19v-1a4.5 4.5 0 0 1 9 0v1" />
        <circle cx="5" cy="9.5" r="2.2" />
        <path d="M3.8 9.6a1.2 1.2 0 0 0 2.4 0" />
        <path d="M1.5 19v-0.8a3.8 3.8 0 0 1 5.2-3.5" />
        <circle cx="19" cy="9.5" r="2.2" />
        <path d="M17.8 9.6a1.2 1.2 0 0 0 2.4 0" />
        <path d="M22.5 19v-0.8a3.8 3.8 0 0 0-5.2-3.5" />
      </svg>
    );
  if (name === "wallet")
    return (
      <svg {...common}>
        <path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7.5" />
        <path d="M16 14h.01" />
      </svg>
    );
  if (name === "plus")
    return (
      <svg {...common}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  if (name === "trend")
    return (
      <svg {...common}>
        <path d="m3 17 6-6 4 4 7-8" />
        <path d="M14 7h6v6" />
      </svg>
    );
  if (name === "arrow")
    return (
      <svg {...common}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );
  if (name === "chevron")
    return (
      <svg {...common}>
        <path d="m9 18 6-6-6-6" />
      </svg>
    );
  if (name === "building")
    return (
      <svg {...common}>
        <path d="M3 21h18M5 21V6l7-3 7 3v15M8 9h.01M8 13h.01M8 17h.01M16 9h.01M16 13h.01M16 17h.01" />
      </svg>
    );
  if (name === "utensils")
    return (
      <svg {...common}>
        <path d="M7 3v6a2 2 0 0 0 2 2v10" />
        <path d="M5 3v4M9 3v4" />
        <path d="M17 3a3.5 3.5 0 0 0-3.5 3.5c0 2.2 1.8 4 3.5 4s3.5-1.8 3.5-4A3.5 3.5 0 0 0 17 3Z" />
        <path d="M17 10.5v10.5" />
      </svg>
    );
  if (name === "train")
    return (
      <svg {...common}>
        <rect x="4" y="3" width="16" height="14" rx="3" />
        <path d="M8 21l2-4M16 21l-2-4M8 8h.01M16 8h.01M4 13h16" />
      </svg>
    );
  if (name === "book")
    return (
      <svg {...common}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z" />
        <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
      </svg>
    );
  if (name === "heart")
    return (
      <svg {...common}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
      </svg>
    );
  if (name === "phone")
    return (
      <svg {...common}>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    );
  if (name === "sparkles")
    return (
      <svg {...common}>
        <path d="m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4L12 3ZM19 16l-.6 2.4L16 19l2.4.6L19 22l.6-2.4L22 19l-2.4-.6L19 16Z" />
      </svg>
    );
  if (name === "calendar")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 2v4M16 2v4M3 10h18" />
      </svg>
    );
  if (name === "lightning")
    return (
      <svg {...common}>
        <path d="m13 2-9 12h7l-1 8 10-13h-7V2Z" />
      </svg>
    );
  if (name === "receipt")
    return (
      <svg {...common}>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  if (name === "card")
    return (
      <svg {...common}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    );
  if (name === "coffee")
    return (
      <svg {...common}>
        <path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z" />
        <path d="M16 10h1a3 3 0 0 1 0 6h-1M7 3v2M11 3v2" />
      </svg>
    );
  if (name === "download")
    return (
      <svg {...common}>
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </svg>
    );
  if (name === "trash")
    return (
      <svg {...common}>
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5" />
      </svg>
    );
  if (name === "edit")
    return (
      <svg {...common}>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    );
  if (name === "search")
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    );
  if (name === "filter")
    return (
      <svg {...common}>
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
    );
  if (name === "more")
    return (
      <svg {...common}>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="m9 12 2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    value || 0
  );
}

function shortDate(date: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function PaymentMark({ method }: { method: Expense["payment"] }) {
  const label = method === "UPI" ? "UPI" : method === "Cash" ? "₹ Cash" : "Card";
  return (
    <span
      className={`grid h-6 min-w-7 place-items-center rounded-md border px-1.5 text-[9px] font-bold tracking-wide ${
        method === "Cash"
          ? "border-[var(--sun)]/30 bg-[var(--sun-soft)] text-[var(--sun)]"
          : method === "UPI"
          ? "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
      }`}
    >
      {label}
    </span>
  );
}

export default function FinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("door-finance-expenses");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("door-finance-budget");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.allowance === "number") return parsed;
        }
      } catch {}
    }
    return defaultBudgetPlan;
  });

  const [bills, setBills] = useState<Bill[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("door-finance-bills");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [isLoaded, setIsLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showBudget, setShowBudget] = useState(false);
  const [showAllEnvelopes, setShowAllEnvelopes] = useState(false);
  const [showBills, setShowBills] = useState(false);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<Category | "All">("All");
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<Expense["payment"] | "All">("All");
  const [activeTransaction, setActiveTransaction] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: "Food & mess" as Category,
    amount: "",
    date: getTodayDateString(),
    payment: "UPI" as Expense["payment"],
  });

  // Dynamic Calendar Details
  const currentMonthName = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date());
  }, []);

  const currentMonthYear = useMemo(() => {
    return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date());
  }, []);

  const currentMonthEyebrow = useMemo(() => {
    return `CAMPUS CASHFLOW · ${currentMonthYear.toUpperCase()}`;
  }, [currentMonthYear]);

  const { daysRemaining, daysInMonth } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const totalDays = new Date(y, m + 1, 0).getDate();
    const remainingDays = Math.max(1, totalDays - d + 1);
    return { daysRemaining: remainingDays, daysInMonth: totalDays };
  }, []);

  // Fetch Supabase Data
  useEffect(() => {
    let isMounted = true;

    async function loadFinanceData() {
      try {
        const res = await fetch("/api/backend/api/finance/data", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (Array.isArray(data.expenses)) {
              setExpenses(data.expenses);
              try {
                window.localStorage.setItem("door-finance-expenses", JSON.stringify(data.expenses));
              } catch {}
            }
            if (data.budget && typeof data.budget.allowance === "number") {
              const updatedBudget: BudgetPlan = {
                allowance: Number(data.budget.allowance) || 0,
                caps: { ...defaultBudgetPlan.caps, ...(data.budget.caps || {}) },
              };
              setBudgetPlan(updatedBudget);
              try {
                window.localStorage.setItem("door-finance-budget", JSON.stringify(updatedBudget));
              } catch {}
            }
            if (Array.isArray(data.bills)) {
              setBills(data.bills);
              try {
                window.localStorage.setItem("door-finance-bills", JSON.stringify(data.bills));
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch finance data from database:", err);
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    }

    loadFinanceData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync to local storage
  useEffect(() => {
    if (isLoaded) {
      try {
        window.localStorage.setItem("door-finance-expenses", JSON.stringify(expenses));
      } catch {}
    }
  }, [expenses, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      try {
        window.localStorage.setItem("door-finance-budget", JSON.stringify(budgetPlan));
      } catch {}
    }
  }, [budgetPlan, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      try {
        window.localStorage.setItem("door-finance-bills", JSON.stringify(bills));
      } catch {}
    }
  }, [bills, isLoaded]);

  const spending = useMemo(() => expenses.reduce((total, expense) => total + expense.amount, 0), [expenses]);
  const monthlyAllowance = budgetPlan.allowance;
  const remaining = monthlyAllowance - spending;
  const spendingPercent =
    monthlyAllowance > 0
      ? Math.min(100, Math.round((spending / monthlyAllowance) * 100))
      : spending > 0
      ? 100
      : 0;
  const dailySafeLimit = monthlyAllowance > 0 ? Math.max(0, Math.floor(remaining / daysRemaining)) : 0;
  const isBudgetPending = monthlyAllowance === 0;

  const groupedSpending = useMemo(() => {
    const list = categoryOrder
      .map((category) => ({
        category,
        spent: expenses
          .filter((expense) => expense.category === category)
          .reduce((total, expense) => total + expense.amount, 0),
        ...categoryMeta[category],
        budget: budgetPlan.caps[category] || 0,
      }))
      .filter((item) => item.spent > 0 || item.budget > 0);

    return list.sort((a, b) => {
      const aOver = a.budget > 0 && a.spent > a.budget;
      const bOver = b.budget > 0 && b.spent > b.budget;

      if (aOver && !bOver) return -1;
      if (!aOver && bOver) return 1;

      if (aOver && bOver) {
        const aExcess = a.spent - a.budget;
        const bExcess = b.spent - b.budget;
        if (aExcess !== bExcess) return bExcess - aExcess;
      }

      return b.budget - a.budget;
    });
  }, [budgetPlan, expenses]);

  const visibleEnvelopes = useMemo(
    () => (showAllEnvelopes ? groupedSpending : groupedSpending.slice(0, 5)),
    [groupedSpending, showAllEnvelopes]
  );
  const mostUsed = [...groupedSpending].sort((a, b) => b.spent - a.spent)[0];

  // Dynamic Multi-Criterion Filter for Ledger
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesTitle = e.title.toLowerCase().includes(q);
          const matchesCategory = e.category.toLowerCase().includes(q);
          const matchesAmount = String(e.amount).includes(q);
          if (!matchesTitle && !matchesCategory && !matchesAmount) return false;
        }
        if (selectedCategoryFilter !== "All" && e.category !== selectedCategoryFilter) return false;
        if (selectedPaymentFilter !== "All" && e.payment !== selectedPaymentFilter) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, searchQuery, selectedCategoryFilter, selectedPaymentFilter]);

  const isFilteringActive = searchQuery.trim().length > 0 || selectedCategoryFilter !== "All" || selectedPaymentFilter !== "All";
  const visibleExpenses = useMemo(() => {
    if (showAll || isFilteringActive) return filteredExpenses;
    return filteredExpenses.slice(0, 5);
  }, [filteredExpenses, showAll, isFilteringActive]);

  const upcomingBills = useMemo(
    () => bills.filter((bill) => !bill.paid).sort((a, b) => a.date.localeCompare(b.date)),
    [bills]
  );
  const overBudgetCategories = groupedSpending.filter((item) => item.budget > 0 && item.spent > item.budget).length;

  // Dynamic Spending Pulse across current calendar month
  const pulseData = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const totalDays = new Date(y, m + 1, 0).getDate();
    const todayDate = now.getDate();
    const monthPrefix = `${y}-${String(m + 1).padStart(2, "0")}`;

    const spendByDay = new Map<number, number>();
    for (const exp of expenses) {
      if (exp.date.startsWith(monthPrefix)) {
        const day = parseInt(exp.date.split("-")[2] || "0", 10);
        if (day > 0) {
          spendByDay.set(day, (spendByDay.get(day) || 0) + exp.amount);
        }
      }
    }

    const intervalCount = 12;
    const step = (totalDays - 1) / (intervalCount - 1);
    const intervals: Array<{ day: number; label: string; spent: number; isToday: boolean }> = [];

    for (let i = 0; i < intervalCount; i++) {
      const targetDay = Math.min(totalDays, Math.max(1, Math.round(1 + i * step)));
      const minDay = i === 0 ? 1 : Math.round(1 + (i - 0.5) * step);
      const maxDay = i === intervalCount - 1 ? totalDays : Math.round(1 + (i + 0.5) * step);

      let intervalSpent = 0;
      for (let d = minDay; d <= maxDay; d++) {
        intervalSpent += spendByDay.get(d) || 0;
      }

      const dObj = new Date(y, m, targetDay);
      const label = dObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      const isTodayInterval = todayDate >= minDay && todayDate <= maxDay;

      intervals.push({
        day: targetDay,
        label,
        spent: intervalSpent,
        isToday: isTodayInterval,
      });
    }

    const maxSpent = Math.max(...intervals.map((i) => i.spent), 100);

    return intervals.map((item) => {
      const heightPercent =
        item.spent > 0 ? Math.min(100, Math.max(16, Math.round((item.spent / maxSpent) * 100))) : 6;

      return {
        dateLabel: item.label,
        heightPercent,
        amount: item.spent,
        isToday: item.isToday,
      };
    });
  }, [expenses]);

  // CSV Export Engine
  const exportToCSV = () => {
    if (expenses.length === 0) {
      toast.error("No expenses to export.");
      return;
    }
    const headers = ["Date", "Title", "Category", "Payment Method", "Amount (INR)"];
    const rows = expenses.map((e) =>
      [`"${e.date}"`, `"${e.title.replace(/"/g, '""')}"`, `"${e.category}"`, `"${e.payment}"`, e.amount].join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `campus-finance-${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Finance snapshot downloaded as CSV");
  };

  const handleSaveExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Add a clear expense name and a valid amount.");
      return;
    }

    const payload = {
      id: editingExpense ? editingExpense.id : undefined,
      title: form.title.trim(),
      category: form.category,
      amount,
      date: form.date,
      payment: form.payment,
    };

    try {
      const res = await fetch("/api/backend/api/finance/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const savedExpense: Expense = data.expense || {
          id: payload.id || `exp-${Date.now()}`,
          title: payload.title,
          category: payload.category,
          amount: payload.amount,
          date: payload.date,
          payment: payload.payment,
        };

        if (editingExpense) {
          setExpenses((current) => current.map((item) => (item.id === editingExpense.id ? savedExpense : item)));
          toast.success("Expense updated in database");
        } else {
          setExpenses((current) => [savedExpense, ...current]);
          toast.success(`Expense added to your ${currentMonthName} ledger`);
        }
      } else {
        toast.error("Failed to save expense to database.");
      }
    } catch {
      toast.error("Network error while saving expense.");
    }

    setShowAddExpense(false);
    setEditingExpense(null);
    setForm({ title: "", category: "Food & mess", amount: "", date: getTodayDateString(), payment: "UPI" });
  };

  const handleStartEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setForm({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date,
      payment: expense.payment,
    });
    setActiveTransaction(null);
    setShowAddExpense(true);
  };

  const deleteExpense = async (id: string) => {
    const expense = expenses.find((item) => item.id === id);
    setExpenses((current) => current.filter((item) => item.id !== id));
    setActiveTransaction(null);

    try {
      await fetch(`/api/backend/api/finance/expense?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      toast.success(`${expense?.title || "Expense"} removed from database`);
    } catch {
      toast.error("Failed to delete expense from database.");
    }
  };

  const saveBudget = async (nextPlan: BudgetPlan) => {
    setBudgetPlan(nextPlan);
    setShowBudget(false);

    try {
      const res = await fetch("/api/backend/api/finance/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextPlan),
      });
      if (res.ok) {
        toast.success(`Your ${currentMonthName} budget is saved in database`);
      } else {
        toast.error("Failed to save budget in database.");
      }
    } catch {
      toast.error("Network error while saving budget.");
    }
  };

  const markBillPaid = async (bill: Bill) => {
    setBills((current) => current.map((item) => (item.id === bill.id ? { ...item, paid: true } : item)));

    try {
      const res = await fetch("/api/backend/api/finance/bill/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bill.id }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.expense) {
          setExpenses((current) => {
            if (current.some((e) => e.id === data.expense.id)) return current;
            return [data.expense, ...current];
          });
        }
        toast.success(`${bill.title} marked paid and recorded in ledger`);
      } else {
        toast.error("Failed to update bill payment in database.");
      }
    } catch {
      toast.error("Network error while updating bill payment.");
    }
  };

  const deleteBill = async (id: string) => {
    setBills((current) => current.filter((bill) => bill.id !== id));

    try {
      await fetch(`/api/backend/api/finance/bill?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      toast.success("Upcoming bill removed from database");
    } catch {
      toast.error("Failed to delete bill from database.");
    }
  };

  const addBill = async (bill: Omit<Bill, "id" | "paid">) => {
    try {
      const res = await fetch("/api/backend/api/finance/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bill, paid: false }),
      });

      if (res.ok) {
        const data = await res.json();
        const newBill: Bill = data.bill || {
          ...bill,
          id: `bill-${Date.now()}`,
          paid: false,
        };
        setBills((current) => [...current, newBill]);
        toast.success("Bill saved in database");
      } else {
        toast.error("Failed to save bill in database.");
      }
    } catch {
      toast.error("Network error while adding bill.");
    }
  };

  const isAnyModalOpen = showAddExpense || showBudget || showBills;

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isAnyModalOpen]);

  return (
    <AppShell
      eyebrow={currentMonthEyebrow}
      title="Campus Cashflow"
      subtitle="Hostel allowances, daily runway, category envelopes, and smart ledger—clear and in control."
      actions={
        <>
          <button
            type="button"
            onClick={exportToCSV}
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <Icon name="download" className="h-3.5 w-3.5" /> Export
          </button>
          <button
            type="button"
            onClick={() => setShowBudget(true)}
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <Icon name="wallet" className="h-3.5 w-3.5" /> {isBudgetPending ? "Set budget & limits" : "Adjust budget"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingExpense(null);
              setForm({ title: "", category: "Food & mess", amount: "", date: getTodayDateString(), payment: "UPI" });
              setShowAddExpense(true);
            }}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[var(--text-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--bg-card)] shadow-xs transition hover:opacity-90 cursor-pointer"
          >
            <Icon name="plus" className="h-3.5 w-3.5" /> Add expense
          </button>
        </>
      }
    >
      <div className="finance-page mx-auto w-full max-w-[1450px] space-y-4 pb-12">
        {/* Top Hero Section: Allowance Runway Banner + Smart Note */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)]"
        >
          {/* Main Allowance Card */}
          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-soft)]">
            <div className="relative overflow-hidden bg-[var(--text-primary)] px-5 py-6 text-[var(--bg-card)] sm:px-7 sm:py-7">
              {/* Subtle Ambient Rings */}
              <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute right-16 top-16 h-28 w-28 rounded-full border border-white/5" />

              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-2.5 flex items-center gap-2 text-[10.5px] font-bold tracking-[0.14em] text-white/60 uppercase">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isBudgetPending ? "bg-[var(--sun)] animate-pulse" : "bg-[var(--mint)]"
                      }`}
                    />
                    {isBudgetPending
                      ? `PLAN PENDING · ${currentMonthName.toUpperCase()} LIMITS`
                      : `YOUR ${currentMonthName.toUpperCase()} ALLOWANCE`}
                  </div>

                  {isBudgetPending ? (
                    <div className="mt-1">
                      <p className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl text-white">
                        ₹0 <span className="text-base font-normal text-white/60">Planned</span>
                      </p>
                      <p className="mt-1.5 max-w-md text-xs leading-5 text-white/70">
                        Set your monthly allowance and category limits to calculate your daily safe limit and unlock
                        real-time cashflow runway tracking.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-3xl font-semibold tracking-[-0.045em] sm:text-[40px] text-white">
                        {formatINR(remaining)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-white/70">
                        {remaining < 0
                          ? `${formatINR(Math.abs(remaining))} over spent from ${formatINR(monthlyAllowance)} allowance`
                          : `left to spend from ${formatINR(monthlyAllowance)} total allowance`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Allowance / Limit Action Button */}
                <button
                  type="button"
                  onClick={() => setShowBudget(true)}
                  className={`group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left backdrop-blur-md transition cursor-pointer focus-ring shrink-0 ${
                    isBudgetPending
                      ? "border-[var(--sun)]/40 bg-[var(--sun)]/15 text-white hover:bg-[var(--sun)]/25"
                      : "border-white/15 bg-white/[0.08] hover:bg-white/15 text-white"
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-lg ${
                      isBudgetPending ? "bg-[var(--sun)]/30 text-[var(--sun)]" : "bg-white/10 text-[var(--accent)]"
                    }`}
                  >
                    <Icon name="wallet" className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/55">
                      {isBudgetPending ? "Action needed" : "Monthly Pace"}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold">
                      {isBudgetPending
                        ? "Set Monthly Budget →"
                        : `${daysRemaining} days left in ${currentMonthName}`}
                    </p>
                  </div>
                </button>
              </div>

              {/* Progress Runway Bar */}
              <div className="relative mt-6">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-white/80">
                  <span className="flex items-center gap-1.5">
                    <span className="text-white/60">Committed:</span> {formatINR(spending)}
                  </span>
                  <span>
                    {isBudgetPending ? (spending > 0 ? "No budget set" : "0% used") : `${spendingPercent}% committed`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${spendingPercent}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    className={`h-full rounded-full transition-colors ${
                      spendingPercent > 90
                        ? "bg-[var(--danger)]"
                        : spendingPercent > 70
                        ? "bg-[var(--sun)]"
                        : "bg-[var(--accent)]"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Metric
                icon="trend"
                label="Monthly spend"
                value={formatINR(spending)}
                note={expenses.length ? `${expenses.length} transaction${expenses.length > 1 ? "s" : ""} logged` : "No expenses logged yet"}
              />
              <div
                onClick={() => {
                  if (isBudgetPending) setShowBudget(true);
                }}
                className={`cursor-pointer transition hover:bg-[var(--bg-elevated)]/50`}
                title={isBudgetPending ? "Click to set monthly budget and unlock daily safe limit" : undefined}
              >
                <Metric
                  icon="calendar"
                  label="Daily safe limit"
                  value={monthlyAllowance > 0 ? `${formatINR(dailySafeLimit)} / day` : "—"}
                  note={
                    isBudgetPending
                      ? "Plan pending · Set budget"
                      : remaining <= 0
                      ? "Allowance exhausted"
                      : `${daysRemaining} days left · Safe pace`
                  }
                  highlightAction={isBudgetPending}
                />
              </div>
              <Metric
                icon="lightning"
                label="Spending status"
                value={
                  isBudgetPending
                    ? spending > 0
                      ? "Needs Plan"
                      : "Plan Pending"
                    : remaining >= 0
                    ? "On Track"
                    : "Over Budget"
                }
                note={
                  isBudgetPending
                    ? "Set your budget limits"
                    : remaining >= 0
                    ? "Allowance covers spend"
                    : "Spend exceeds allowance"
                }
                statusType={isBudgetPending ? "warning" : remaining >= 0 ? "success" : "danger"}
              />
            </div>
          </div>

          {/* Smart Insights & Context Card */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5.5 shadow-[var(--shadow-tight)] sm:p-6.5">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-[var(--mint-soft)] opacity-70 pointer-events-none" />

            <div>
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--mint)]">SMART NOTE</p>
                  <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-primary)]">
                    Your money, in context
                  </h2>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--mint-soft)] text-[var(--mint)]">
                  <Icon name="sparkles" className="h-4.5 w-4.5" />
                </span>
              </div>

              <div className="relative mt-4.5 rounded-xl border border-[var(--mint)]/20 bg-[var(--mint-soft)]/60 p-4">
                <p className="text-xs font-semibold leading-5 text-[var(--text-primary)]">
                  {expenses.length > 0
                    ? `You've allocated ${formatINR(spending)} across ${expenses.length} tracked items this month.`
                    : `Your ${currentMonthName} ledger is clear and connected to database.`}
                </p>
                <p className="mt-1.5 text-[11.5px] leading-5 text-[var(--text-secondary)]">
                  {expenses.length > 0
                    ? `Your top category is ${mostUsed?.category.toLowerCase() || "essentials"} at ${formatINR(
                        mostUsed?.spent || 0
                      )}.`
                    : "Logging daily expenses (UPI, cash, card) calculates your daily spending runway, monitors envelope caps, and prevents end-of-month financial crunch."}
                </p>
              </div>
            </div>

            <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-4 text-xs font-medium text-[var(--text-secondary)]">
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] ${
                    overBudgetCategories
                      ? "text-[var(--danger)] font-bold"
                      : isBudgetPending
                      ? "text-[var(--sun)]"
                      : "text-[var(--success)]"
                  }`}
                >
                  <Icon name={overBudgetCategories ? "lightning" : isBudgetPending ? "more" : "check"} className="h-3 w-3" />
                </span>
                <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                  {overBudgetCategories
                    ? `${overBudgetCategories} category needs attention`
                    : isBudgetPending
                    ? "Budget plan not yet defined"
                    : "All category caps healthy"}
                </span>
              </div>

              {isBudgetPending && (
                <button
                  type="button"
                  onClick={() => setShowBudget(true)}
                  className="text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  Set limits →
                </button>
              )}
            </div>
          </div>
        </motion.section>

        {/* Second Row: Spending Pulse & Upcoming Bills */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.95fr)]"
        >
          {/* Spending Pulse Chart Card */}
          <div className="surface overflow-hidden rounded-2xl p-5 sm:p-6.5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-label">SPENDING PULSE</p>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-primary)]">
                  A calmer month, one day at a time
                </h2>
                <p className="mt-1 text-[11.5px] font-medium text-[var(--text-secondary)]">
                  Real daily expenditure across {currentMonthName}.
                </p>
              </div>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1 text-[10.5px] font-semibold text-[var(--text-secondary)]">
                {currentMonthName} {new Date().getFullYear()}
              </span>
            </div>

            {expenses.length > 0 ? (
              <>
                <div className="mt-6 grid h-[156px] grid-cols-12 items-end gap-1.5 border-b border-[var(--border)] px-1 sm:gap-2">
                  {pulseData.map((bar, index) => (
                    <div key={index} className="group relative flex h-full flex-col justify-end items-center cursor-pointer">
                      {/* Tooltip on Hover */}
                      <div className="absolute -top-11 z-30 hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)]/95 backdrop-blur-md px-2.5 py-1 text-center shadow-xl group-hover:block whitespace-nowrap pointer-events-none">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          {bar.dateLabel}
                        </p>
                        <p className="text-[11px] font-bold text-[var(--accent)]">{formatINR(bar.amount)} spent</p>
                      </div>

                      {/* Vertical Hover Guideline */}
                      <div className="absolute inset-y-0 w-px bg-[var(--accent)]/25 hidden group-hover:block pointer-events-none" />

                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${bar.heightPercent}%` }}
                        transition={{ delay: 0.05 + index * 0.02, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className={`w-full min-h-1.5 rounded-t-sm transition-colors ${
                          bar.isToday
                            ? "bg-[var(--accent)] shadow-xs shadow-[var(--accent)]/30"
                            : bar.amount > 0
                            ? "bg-[var(--mint)]/75 group-hover:bg-[var(--mint)]"
                            : "bg-[var(--border-strong)]/40 group-hover:bg-[var(--accent)]/60"
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between px-1 text-[10.5px] font-medium text-[var(--text-faint)]">
                  <span>Day 1</span>
                  <span>Mid Month</span>
                  <span>Day {daysInMonth}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--text-secondary)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" /> Active Today
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--text-secondary)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--mint)]" /> Logged Spend
                  </span>
                </div>
              </>
            ) : (
              /* Polished Empty State for Spending Pulse */
              <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/30 px-6 py-8 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] text-[var(--accent)] shadow-xs">
                  <Icon name="trend" className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                  No spending recorded for {currentMonthName} yet
                </h3>
                <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--text-secondary)]">
                  As you log your daily spends via UPI, Cash, or Card, this chart will dynamically map your daily pace
                  and peak spending days.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingExpense(null);
                    setForm({ title: "", category: "Food & mess", amount: "", date: getTodayDateString(), payment: "UPI" });
                    setShowAddExpense(true);
                  }}
                  className="focus-ring mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--text-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--bg-card)] shadow-xs hover:opacity-90 cursor-pointer"
                >
                  <Icon name="plus" className="h-3.5 w-3.5" /> Log your first expense
                </button>
              </div>
            )}
          </div>

          {/* Upcoming Bills Section */}
          <div className="surface flex flex-col justify-between rounded-2xl p-5 sm:p-6.5">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-label">UP NEXT</p>
                  <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-primary)]">
                    Small bills, no surprises
                  </h2>
                  <p className="mt-1 text-[11.5px] font-medium text-[var(--text-secondary)]">
                    Recurring mess dues, room rent, and subscriptions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBills(true)}
                  className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-elevated)] cursor-pointer"
                >
                  Manage bills
                </button>
              </div>

              <div className="mt-4.5 divide-y divide-[var(--border)]">
                {upcomingBills.length ? (
                  upcomingBills.slice(0, 3).map((bill) => <UpcomingBill key={bill.id} bill={bill} />)
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/30 py-7 px-4 text-center">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--bg-elevated)] text-[var(--text-faint)]">
                      <Icon name="receipt" className="h-4.5 w-4.5" />
                    </span>
                    <p className="mt-2 text-xs font-semibold text-[var(--text-primary)]">No upcoming bills due</p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      Add recurring expenses to ensure you never miss payment deadlines.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowBills(true)}
                      className="focus-ring mt-3 text-[11px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      + Add a recurring bill
                    </button>
                  </div>
                )}
              </div>
            </div>

            {upcomingBills.length > 0 && (
              <div className="mt-4 border-t border-[var(--border)]/60 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBills(true)}
                  className="focus-ring text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                >
                  View all upcoming bills ({upcomingBills.length}) →
                </button>
              </div>
            )}
          </div>
        </motion.section>

        {/* Third Row: Category Envelopes & Live Ledger */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.11, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="grid gap-4 items-start xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.45fr)]"
        >
          {/* Your Category Envelopes */}
          <div className="surface rounded-2xl p-5 sm:p-6.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="section-label">YOUR ENVELOPES</p>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-primary)]">
                  Every rupee has a job
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  {monthlyAllowance > 0 ? `${formatINR(monthlyAllowance)} plan` : "No plan set"}
                </span>
                {groupedSpending.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAllEnvelopes((prev) => !prev)}
                    className="focus-ring text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    {showAllEnvelopes ? "Collapse" : `View all (${groupedSpending.length})`}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {visibleEnvelopes.length > 0 ? (
                visibleEnvelopes.map(({ category, spent, budget, icon, color, soft }) => {
                  const isOverBudget = budget > 0 && spent > budget;
                  const percentage =
                    budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : spent > 0 ? 100 : 0;
                  return (
                    <div key={category}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            style={{ background: soft, color }}
                            className="grid h-6.5 w-6.5 place-items-center rounded-md shrink-0"
                          >
                            <Icon name={icon} className="h-3.5 w-3.5" />
                          </span>
                          <span className="truncate text-xs font-semibold text-[var(--text-primary)]">{category}</span>
                          {isOverBudget && (
                            <span
                              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)] text-[9px] font-black"
                              title={`${category} is over budget by ${formatINR(spent - budget)}!`}
                            >
                              !
                            </span>
                          )}
                        </div>
                        <span
                          className={`shrink-0 text-[11px] font-semibold tabular-nums ${
                            isOverBudget ? "text-[var(--danger)] font-bold" : "text-[var(--text-secondary)]"
                          }`}
                        >
                          {formatINR(spent)}{" "}
                          <span className="text-[var(--text-faint)] font-normal">/ {formatINR(budget)}</span>
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--track)]">
                        <div
                          style={{
                            width: `${percentage}%`,
                            background: isOverBudget ? "var(--danger)" : color,
                          }}
                          className="h-full rounded-full transition-[width] duration-500"
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/30 py-8 px-4 text-center">
                  <div className="flex -space-x-1.5">
                    {categoryOrder.slice(0, 4).map((cat) => {
                      const meta = categoryMeta[cat];
                      return (
                        <span
                          key={cat}
                          style={{ background: meta.soft, color: meta.color }}
                          className="grid h-8 w-8 place-items-center rounded-full border-2 border-[var(--bg-card)]"
                        >
                          <Icon name={meta.icon} className="h-3.5 w-3.5" />
                        </span>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs font-semibold text-[var(--text-primary)]">No category caps configured</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                    Allocate spending caps for Food, Travel, Academics, and Subscriptions.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowBudget(true)}
                    className="focus-ring mt-3 text-[11.5px] font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    + Configure Category Envelopes →
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowBudget(true)}
              className="focus-ring mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline cursor-pointer"
            >
              Set or adjust category envelopes <Icon name="arrow" className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Live Ledger / Expense Transactions */}
          <div className="surface overflow-hidden rounded-2xl">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="section-label">LIVE LEDGER</p>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-[var(--text-primary)]">
                  {isFilteringActive ? `Filtered expenses (${visibleExpenses.length})` : "Recent expenses"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilterBar((prev) => !prev)}
                  className={`focus-ring inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    showFilterBar || isFilteringActive
                      ? "border-[var(--accent)]/50 bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <Icon name="filter" className="h-3.5 w-3.5" />
                  Filter {isFilteringActive && "•"}
                </button>

                {/* View All Button: ONLY show when there are extra items exceeding 5 items */}
                {filteredExpenses.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((value) => !value)}
                    className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {showAll ? "Show recent (5)" : `View all (${filteredExpenses.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Filter Drawer */}
            {showFilterBar && (
              <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border)] bg-[var(--bg-elevated)]/40 px-5 py-3 sm:px-6">
                <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
                  <span className="absolute left-2.5 top-2.5 text-[var(--text-faint)]">
                    <Icon name="search" className="h-3.5 w-3.5" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search expenses..."
                    className="app-input h-8.5 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] pl-8 pr-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-faint)] outline-none"
                  />
                </div>
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value as Category | "All")}
                  className="app-input h-8.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 text-xs font-medium text-[var(--text-primary)] outline-none cursor-pointer"
                >
                  <option value="All">All categories</option>
                  {categoryOrder.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedPaymentFilter}
                  onChange={(e) => setSelectedPaymentFilter(e.target.value as Expense["payment"] | "All")}
                  className="app-input h-8.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 text-xs font-medium text-[var(--text-primary)] outline-none cursor-pointer"
                >
                  <option value="All">All payment modes</option>
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
                {isFilteringActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategoryFilter("All");
                      setSelectedPaymentFilter("All");
                    }}
                    className="focus-ring text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}

            {/* Expense Rows */}
            <div className="divide-y divide-[var(--border)]">
              {visibleExpenses.length > 0 ? (
                visibleExpenses.map((expense) => {
                  const meta = categoryMeta[expense.category] || categoryMeta["Others"];
                  return (
                    <div
                      key={expense.id}
                      className="group relative flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-[var(--bg-elevated)]/50 sm:px-6"
                    >
                      <span
                        style={{ background: meta.soft, color: meta.color }}
                        className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl"
                      >
                        <Icon name={meta.icon} className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{expense.title}</p>
                        <p className="mt-0.5 text-[10.5px] font-medium text-[var(--text-secondary)]">
                          {expense.category} · {shortDate(expense.date)}
                        </p>
                      </div>
                      <PaymentMark method={expense.payment} />
                      <span className="w-20 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                        −{formatINR(expense.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTransaction(activeTransaction === expense.id ? null : expense.id)}
                        aria-label={`Options for ${expense.title}`}
                        className="focus-ring grid h-7 w-7 place-items-center rounded-md text-[var(--text-faint)] opacity-100 transition hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                      >
                        <Icon name="more" className="h-4 w-4" />
                      </button>
                      {activeTransaction === expense.id && (
                        <div className="absolute right-5 top-11 z-20 w-38 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-1.5 shadow-[var(--shadow-soft)]">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(expense)}
                            className="focus-ring flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
                          >
                            <Icon name="edit" className="h-3.5 w-3.5 text-[var(--text-secondary)]" /> Edit expense
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteExpense(expense.id)}
                            className="focus-ring flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" /> Delete expense
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                /* Polished Empty State for Live Ledger */
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-faint)]">
                    <Icon name="receipt" className="h-6 w-6" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                    {isFilteringActive
                      ? "No expenses match your search or filter"
                      : `No transactions in your ${currentMonthName} ledger yet`}
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
                    {isFilteringActive
                      ? "Try searching for a different item name or reset your category and payment filters."
                      : "Start logging your daily spends (mess, chai, prints, books, travel) to build your student financial pulse."}
                  </p>
                  {isFilteringActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedCategoryFilter("All");
                        setSelectedPaymentFilter("All");
                      }}
                      className="focus-ring mt-4 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExpense(null);
                        setForm({ title: "", category: "Food & mess", amount: "", date: getTodayDateString(), payment: "UPI" });
                        setShowAddExpense(true);
                      }}
                      className="focus-ring mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--text-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--bg-card)] shadow-xs hover:opacity-90 cursor-pointer"
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" /> Add expense
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.section>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddExpense && (
          <ExpenseModal
            form={form}
            editingId={editingExpense?.id}
            onChange={setForm}
            onClose={() => {
              setShowAddExpense(false);
              setEditingExpense(null);
            }}
            onSubmit={handleSaveExpense}
          />
        )}
        {showBudget && (
          <BudgetModal
            monthName={currentMonthName}
            daysRemaining={daysRemaining}
            budgetPlan={budgetPlan}
            onClose={() => setShowBudget(false)}
            onSave={saveBudget}
          />
        )}
        {showBills && (
          <BillsModal
            bills={bills}
            onClose={() => setShowBills(false)}
            onMarkPaid={markBillPaid}
            onDelete={deleteBill}
            onAdd={addBill}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function Metric({
  icon,
  label,
  value,
  note,
  highlightAction = false,
  statusType,
}: {
  icon: IconName;
  label: string;
  value: string;
  note: string;
  highlightAction?: boolean;
  statusType?: "success" | "warning" | "danger";
}) {
  const iconBg =
    statusType === "success"
      ? "bg-[var(--mint-soft)] text-[var(--mint)]"
      : statusType === "warning"
      ? "bg-[var(--sun-soft)] text-[var(--sun)]"
      : statusType === "danger"
      ? "bg-[var(--danger-soft)] text-[var(--danger)]"
      : highlightAction
      ? "bg-[var(--sun-soft)] text-[var(--sun)]"
      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]";

  return (
    <div className="flex min-w-0 items-center gap-3.5 px-5 py-4 sm:px-6">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconBg}`}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-faint)]">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
        <p
          className={`mt-0.5 truncate text-[10.5px] font-medium ${
            highlightAction ? "text-[var(--sun)] font-semibold" : "text-[var(--text-secondary)]"
          }`}
        >
          {note}
        </p>
      </div>
    </div>
  );
}

function UpcomingBill({ bill }: { bill: Bill }) {
  const meta = categoryMeta[bill.category] || categoryMeta["Others"];
  return (
    <div className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
      <span style={{ color: meta.color, background: meta.soft }} className="grid h-8.5 w-8.5 place-items-center rounded-xl">
        <Icon name={meta.icon} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[var(--text-primary)]">{bill.title}</p>
        <p className="mt-0.5 text-[10.5px] font-medium text-[var(--text-secondary)]">Due {shortDate(bill.date)}</p>
      </div>
      <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">{formatINR(bill.amount)}</span>
    </div>
  );
}

function BudgetModal({
  monthName,
  daysRemaining,
  budgetPlan,
  onClose,
  onSave,
}: {
  monthName: string;
  daysRemaining: number;
  budgetPlan: BudgetPlan;
  onClose: () => void;
  onSave: (plan: BudgetPlan) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [draft, setDraft] = useState<BudgetPlan>({
    allowance: budgetPlan.allowance,
    caps: { ...budgetPlan.caps },
  });

  const plannedTotal = categoryOrder.reduce((total, category) => total + (Number(draft.caps[category]) || 0), 0);
  const unallocated = draft.allowance - plannedTotal;
  const computedDailySafe = draft.allowance > 0 ? Math.floor(draft.allowance / daysRemaining) : 0;

  const updateCap = (category: Category, value: string) => {
    setDraft((current) => ({ ...current, caps: { ...current.caps, [category]: Math.max(0, Number(value) || 0) } }));
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(draft.allowance) || draft.allowance <= 0) {
      toast.error("Set a monthly allowance above ₹0.");
      return;
    }
    if (plannedTotal > draft.allowance) {
      toast.error("Your category caps exceed your monthly allowance.");
      return;
    }
    onSave(draft);
  };

  const allowancePresets = [5000, 8000, 12000, 15000, 20000];

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md overflow-y-auto sm:p-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <motion.form
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSave}
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-title"
        className="my-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5.5 shadow-2xl sm:p-7 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              {monthName.toUpperCase()} BUDGET & LIMITS
            </p>
            <h2 id="budget-title" className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Set your monthly budget plan
            </h2>
            <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-secondary)]">
              Define your monthly allowance and category limits to calculate your daily safe pace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            aria-label="Close"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>

        {/* Total Allowance Input Card */}
        <div className="mt-5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
            Total Monthly Allowance
          </span>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-2xl font-semibold text-[var(--text-secondary)]">₹</span>
            <input
              required
              min="1"
              type="number"
              placeholder="e.g. 12000"
              value={draft.allowance || ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  allowance: Math.max(0, Number(event.target.value) || 0),
                }))
              }
              className="w-full bg-transparent text-3xl font-bold tracking-tight text-[var(--text-primary)] outline-none"
            />
          </div>

          {/* Quick Preset Chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--accent)]/20 pt-2.5">
            <span className="text-[10px] font-semibold text-[var(--text-secondary)] mr-1">Presets:</span>
            {allowancePresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setDraft((current) => ({ ...current, allowance: preset }))}
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                  draft.allowance === preset
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg-card)]"
                    : "border-[var(--accent)]/30 bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                }`}
              >
                ₹{preset.toLocaleString("en-IN")}
              </button>
            ))}
          </div>
        </div>

        {/* Computed Safe Limit Guide */}
        {draft.allowance > 0 && (
          <div className="mt-3.5 flex items-center justify-between rounded-xl border border-[var(--mint)]/25 bg-[var(--mint-soft)]/70 px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--mint-soft)] text-[var(--mint)]">
                <Icon name="sparkles" className="h-3.5 w-3.5" />
              </span>
              <span className="font-semibold text-[var(--text-primary)]">
                Daily Safe Limit: <span className="text-[var(--mint)] font-bold">{formatINR(computedDailySafe)} / day</span>
              </span>
            </div>
            <span className="text-[10.5px] font-medium text-[var(--text-secondary)]">
              {daysRemaining} days left in {monthName}
            </span>
          </div>
        )}

        {/* Category Caps Section */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">Category spending envelopes</p>
              <p className="mt-0.5 text-[10.5px] font-medium text-[var(--text-secondary)]">
                Set a realistic maximum for each part of student life.
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                unallocated < 0
                  ? "bg-[var(--danger-soft)] text-[var(--danger)]"
                  : "bg-[var(--mint-soft)] text-[var(--mint)]"
              }`}
            >
              {unallocated < 0
                ? `${formatINR(Math.abs(unallocated))} over-allocated`
                : `${formatINR(unallocated)} unallocated`}
            </span>
          </div>

          <div className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] px-3.5 bg-[var(--bg-card)]">
            {categoryOrder.map((category) => {
              const meta = categoryMeta[category];
              return (
                <label key={category} className="flex items-center gap-3 py-2.5 cursor-pointer">
                  <span
                    style={{ background: meta.soft, color: meta.color }}
                    className="grid h-7 w-7 place-items-center rounded-lg"
                  >
                    <Icon name={meta.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 text-xs font-semibold text-[var(--text-primary)]">{category}</span>
                  <span className="text-xs font-semibold text-[var(--text-secondary)]">₹</span>
                  <input
                    min="0"
                    type="number"
                    value={draft.caps[category] || 0}
                    onChange={(event) => updateCap(category, event.target.value)}
                    className="w-20 bg-transparent text-right text-xs font-bold tabular-nums text-[var(--text-primary)] outline-none"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-4.5 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2.5 text-xs">
          <span className="font-medium text-[var(--text-secondary)]">Allocated to categories</span>
          <span className="font-bold tabular-nums text-[var(--text-primary)]">{formatINR(plannedTotal)}</span>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-4 py-2 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 cursor-pointer shadow-xs"
          >
            <Icon name="check" className="h-3.5 w-3.5" /> Save budget plan
          </button>
        </div>
      </motion.form>
    </motion.div>,
    document.body
  );
}

function BillsModal({
  bills,
  onClose,
  onMarkPaid,
  onDelete,
  onAdd,
}: {
  bills: Bill[];
  onClose: () => void;
  onMarkPaid: (bill: Bill) => void;
  onDelete: (id: string) => void;
  onAdd: (bill: Omit<Bill, "id" | "paid">) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    date: getTodayDateString(),
    amount: "",
    category: "Subscriptions" as Category,
  });
  const sortedBills = [...bills].sort((a, b) => Number(a.paid) - Number(b.paid) || a.date.localeCompare(b.date));

  const submitBill = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Add a bill name and a valid amount.");
      return;
    }
    onAdd({ title: draft.title.trim(), date: draft.date, amount, category: draft.category });
    setDraft({ title: "", date: getTodayDateString(), amount: "", category: "Subscriptions" });
    setAdding(false);
  };

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md overflow-y-auto sm:p-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bills-title"
        className="my-auto max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5.5 shadow-2xl sm:p-7 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">PAYMENT CALENDAR</p>
            <h2 id="bills-title" className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Manage recurring bills
            </h2>
            <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-secondary)]">
              Mark something paid and it will automatically link into your expense ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            aria-label="Close"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>

        <div className="mt-5 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] px-3.5 bg-[var(--bg-card)]">
          {sortedBills.length ? (
            sortedBills.map((bill) => {
              const meta = categoryMeta[bill.category] || categoryMeta["Others"];
              return (
                <div key={bill.id} className={`flex items-center gap-3 py-3 ${bill.paid ? "opacity-50" : ""}`}>
                  <span
                    style={{ background: meta.soft, color: meta.color }}
                    className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl"
                  >
                    <Icon name={meta.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[var(--text-primary)]">{bill.title}</p>
                    <p className="mt-0.5 text-[10.5px] font-medium text-[var(--text-secondary)]">
                      {bill.paid ? "Paid" : `Due ${shortDate(bill.date)}`} · {bill.category}
                    </p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                    {formatINR(bill.amount)}
                  </span>
                  {bill.paid ? (
                    <span className="rounded-md bg-[var(--mint-soft)] px-2 py-1 text-[9px] font-bold text-[var(--mint)]">
                      PAID
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMarkPaid(bill)}
                      className="focus-ring rounded-lg bg-[var(--text-primary)] px-2.5 py-1 text-[10px] font-bold text-[var(--bg-card)] hover:opacity-90 cursor-pointer"
                    >
                      Mark paid
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(bill.id)}
                    className="focus-ring grid h-7 w-7 place-items-center rounded-lg text-[var(--text-faint)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] cursor-pointer"
                    aria-label={`Remove ${bill.title}`}
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="py-10 text-center text-xs font-medium text-[var(--text-secondary)]">
              No bills recorded yet. Add any recurring expense you want to track.
            </div>
          )}
        </div>

        <div className="mt-4">
          {adding ? (
            <form onSubmit={submitBill} className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] p-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_110px]">
                <input
                  autoFocus
                  required
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  placeholder="Bill name (e.g. WiFi dues)"
                  className="app-input h-9.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]"
                />
                <div className="flex h-9.5 items-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5">
                  <span className="text-xs text-[var(--text-secondary)]">₹</span>
                  <input
                    required
                    min="1"
                    type="number"
                    value={draft.amount}
                    onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                    placeholder="Amount"
                    className="min-w-0 flex-1 bg-transparent pl-1 text-xs font-semibold text-[var(--text-primary)] outline-none"
                  />
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                  className="app-input h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 text-xs font-medium text-[var(--text-primary)]"
                />
                <select
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })}
                  className="app-input h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 text-xs font-medium text-[var(--text-primary)]"
                >
                  {categoryOrder.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3.5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="focus-ring px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="focus-ring rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg-card)] cursor-pointer"
                >
                  Add bill
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="focus-ring inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
            >
              <Icon name="plus" className="h-3.5 w-3.5" /> Add a new bill
            </button>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function ExpenseModal({
  form,
  editingId,
  onChange,
  onClose,
  onSubmit,
}: {
  form: { title: string; category: Category; amount: string; date: string; payment: Expense["payment"] };
  editingId?: string | null;
  onChange: (form: { title: string; category: Category; amount: string; date: string; payment: Expense["payment"] }) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md overflow-y-auto sm:p-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <motion.form
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-title"
        className="my-auto w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5.5 shadow-2xl sm:p-7 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
              {editingId ? "EDIT ENTRY" : "NEW TRANSACTION"}
            </p>
            <h2 id="expense-title" className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              {editingId ? "Edit expense" : "Add to ledger"}
            </h2>
            <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
              A little logging now means less money stress later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            aria-label="Close"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
              What did you pay for?
            </span>
            <input
              autoFocus
              required
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder="e.g. Hostel mess top-up, chai, books..."
              className="app-input h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)] placeholder:text-[var(--text-faint)]"
            />
          </label>

          <div className="grid grid-cols-[1fr_130px] gap-3">
            <label className="grid gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Category
              </span>
              <select
                value={form.category}
                onChange={(event) => onChange({ ...form, category: event.target.value as Category })}
                className="app-input h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]"
              >
                {categoryOrder.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Amount
              </span>
              <div className="flex h-10 items-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3">
                <span className="text-xs font-bold text-[var(--text-secondary)]">₹</span>
                <input
                  required
                  inputMode="decimal"
                  min="1"
                  type="number"
                  value={form.amount}
                  onChange={(event) => onChange({ ...form, amount: event.target.value })}
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent pl-1.5 text-xs font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)]"
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Date
              </span>
              <input
                type="date"
                value={form.date}
                onChange={(event) => onChange({ ...form, date: event.target.value })}
                className="app-input h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                Payment mode
              </span>
              <select
                value={form.payment}
                onChange={(event) => onChange({ ...form, payment: event.target.value as Expense["payment"] })}
                className="app-input h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]"
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-xl border border-[var(--border)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-4 py-2 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 cursor-pointer shadow-xs"
          >
            <Icon name={editingId ? "check" : "plus"} className="h-3.5 w-3.5" />{" "}
            {editingId ? "Update expense" : "Add to ledger"}
          </button>
        </div>
      </motion.form>
    </motion.div>,
    document.body
  );
}
