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
  | "Fun & social";

type Expense = {
  id: string;
  title: string;
  category: Category;
  amount: number;
  date: string;
  payment: "UPI" | "Cash" | "Card";
};

const categoryMeta: Record<Category, { icon: IconName; color: string; soft: string; budget: number }> = {
  "Hostel & utilities": { icon: "building", color: "var(--lavender)", soft: "var(--lavender-soft)", budget: 4000 },
  "Food & mess": { icon: "utensils", color: "var(--sun)", soft: "var(--sun-soft)", budget: 2800 },
  "Travel & commute": { icon: "train", color: "var(--teal)", soft: "var(--teal-soft)", budget: 1200 },
  Academics: { icon: "book", color: "var(--mint)", soft: "var(--mint-soft)", budget: 1200 },
  "Personal & health": { icon: "heart", color: "var(--danger)", soft: "var(--danger-soft)", budget: 800 },
  Subscriptions: { icon: "phone", color: "var(--accent)", soft: "var(--accent-soft)", budget: 500 },
  "Fun & social": { icon: "sparkles", color: "var(--lavender)", soft: "var(--lavender-soft)", budget: 1000 },
};

const initialExpenses: Expense[] = [
  { id: "hostel", title: "Hostel room fee", category: "Hostel & utilities", amount: 3250, date: "2026-08-01", payment: "UPI" },
  { id: "mess", title: "Mess recharge", category: "Food & mess", amount: 2100, date: "2026-08-02", payment: "UPI" },
  { id: "metro", title: "Metro & auto top-up", category: "Travel & commute", amount: 620, date: "2026-08-05", payment: "Card" },
  { id: "books", title: "Semester books", category: "Academics", amount: 950, date: "2026-08-06", payment: "UPI" },
  { id: "mobile", title: "Mobile data recharge", category: "Subscriptions", amount: 299, date: "2026-08-07", payment: "UPI" },
  { id: "laundry", title: "Laundry & essentials", category: "Personal & health", amount: 260, date: "2026-08-08", payment: "Cash" },
  { id: "cafe", title: "Café with friends", category: "Fun & social", amount: 420, date: "2026-08-09", payment: "UPI" },
  { id: "pharmacy", title: "Pharmacy run", category: "Personal & health", amount: 231, date: "2026-08-09", payment: "UPI" },
  { id: "late-night", title: "Late-night dinner", category: "Food & mess", amount: 300, date: "2026-08-10", payment: "UPI" },
];

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
  allowance: 12000,
  caps: {
    "Hostel & utilities": 4000,
    "Food & mess": 2800,
    "Travel & commute": 1200,
    Academics: 1200,
    "Personal & health": 800,
    Subscriptions: 500,
    "Fun & social": 1000,
  },
};

const initialBills: Bill[] = [
  { id: "wifi", title: "Hostel Wi-Fi", date: "2026-08-17", amount: 399, category: "Hostel & utilities", paid: false },
  { id: "friends", title: "Friends' plan", date: "2026-08-18", amount: 350, category: "Fun & social", paid: false },
  { id: "music", title: "Music subscription", date: "2026-08-19", amount: 59, category: "Subscriptions", paid: false },
];

type IconName = "arrow" | "book" | "building" | "calendar" | "card" | "check" | "chevron" | "coffee" | "download" | "heart" | "lightning" | "more" | "phone" | "plus" | "receipt" | "sparkles" | "train" | "trash" | "trend" | "utensils" | "wallet";

function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  const common = { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className, "aria-hidden": true };
  if (name === "wallet") return <svg {...common}><path d="M20 7V6a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v8a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7.5"/><path d="M16 14h.01"/></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
  if (name === "trend") return <svg {...common}><path d="m3 17 6-6 4 4 7-8"/><path d="M14 7h6v6"/></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
  if (name === "chevron") return <svg {...common}><path d="m9 18 6-6-6-6"/></svg>;
  if (name === "building") return <svg {...common}><path d="M3 21h18M5 21V6l7-3 7 3v15M8 9h.01M8 13h.01M8 17h.01M16 9h.01M16 13h.01M16 17h.01"/></svg>;
  if (name === "utensils") return <svg {...common}><path d="M4 3v7a4 4 0 0 0 4 4V3M8 3v4M16 3v18M16 3a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4"/></svg>;
  if (name === "train") return <svg {...common}><rect x="4" y="3" width="16" height="14" rx="3"/><path d="M8 21l2-4M16 21l-2-4M8 8h.01M16 8h.01M4 13h16"/></svg>;
  if (name === "book") return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>;
  if (name === "heart") return <svg {...common}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/></svg>;
  if (name === "phone") return <svg {...common}><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>;
  if (name === "sparkles") return <svg {...common}><path d="m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4L12 3ZM19 16l-.6 2.4L16 19l2.4.6L19 22l.6-2.4L22 19l-2.4-.6L19 16Z"/></svg>;
  if (name === "calendar") return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>;
  if (name === "lightning") return <svg {...common}><path d="m13 2-9 12h7l-1 8 10-13h-7V2Z"/></svg>;
  if (name === "receipt") return <svg {...common}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
  if (name === "card") return <svg {...common}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>;
  if (name === "coffee") return <svg {...common}><path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z"/><path d="M16 10h1a3 3 0 0 1 0 6h-1M7 3v2M11 3v2"/></svg>;
  if (name === "download") return <svg {...common}><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>;
  if (name === "trash") return <svg {...common}><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/></svg>;
  if (name === "more") return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></svg>;
  return <svg {...common}><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>;
}

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

function PaymentMark({ method }: { method: Expense["payment"] }) {
  const label = method === "UPI" ? "UPI" : method === "Cash" ? "₹" : "CARD";
  return <span className={`grid h-7 min-w-7 place-items-center rounded-md border px-1 text-[8px] font-bold tracking-wide ${method === "Cash" ? "border-[var(--sun)]/20 bg-[var(--sun-soft)] text-[var(--sun)]" : "border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}>{label}</span>;
}

export default function FinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan>(defaultBudgetPlan);
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [showBills, setShowBills] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", category: "Food & mess" as Category, amount: "", date: "2026-08-10", payment: "UPI" as Expense["payment"] });

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("door-finance-expenses");
        if (saved) {
          const parsed = JSON.parse(saved) as Expense[];
          if (Array.isArray(parsed) && parsed.length) setExpenses(parsed);
        }
        const savedBudget = window.localStorage.getItem("door-finance-budget");
        if (savedBudget) {
          const parsedBudget = JSON.parse(savedBudget) as BudgetPlan;
          if (Number.isFinite(parsedBudget.allowance) && parsedBudget.allowance > 0 && parsedBudget.caps) {
            setBudgetPlan({
              allowance: parsedBudget.allowance,
              caps: { ...defaultBudgetPlan.caps, ...parsedBudget.caps },
            });
          }
        }
        const savedBills = window.localStorage.getItem("door-finance-bills");
        if (savedBills) {
          const parsedBills = JSON.parse(savedBills) as Bill[];
          if (Array.isArray(parsedBills)) setBills(parsedBills);
        }
      } catch {
        // The seed data remains available if storage is unavailable or malformed.
      } finally {
        setIsLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem("door-finance-expenses", JSON.stringify(expenses));
  }, [expenses, isLoaded]);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem("door-finance-budget", JSON.stringify(budgetPlan));
  }, [budgetPlan, isLoaded]);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem("door-finance-bills", JSON.stringify(bills));
  }, [bills, isLoaded]);

  const spending = useMemo(() => expenses.reduce((total, expense) => total + expense.amount, 0), [expenses]);
  const monthlyAllowance = budgetPlan.allowance;
  const remaining = Math.max(0, monthlyAllowance - spending);
  const spendingPercent = Math.min(100, Math.round((spending / monthlyAllowance) * 100));
  const groupedSpending = useMemo(() => categoryOrder.map((category) => ({
    category,
    spent: expenses.filter((expense) => expense.category === category).reduce((total, expense) => total + expense.amount, 0),
    ...categoryMeta[category],
    budget: budgetPlan.caps[category],
  })).filter((item) => item.spent > 0 || item.budget > 0), [budgetPlan, expenses]);
  const mostUsed = [...groupedSpending].sort((a, b) => b.spent - a.spent)[0];
  const visibleExpenses = useMemo(() => [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, showAll ? undefined : 5), [expenses, showAll]);
  const upcomingBills = useMemo(() => bills.filter((bill) => !bill.paid).sort((a, b) => a.date.localeCompare(b.date)), [bills]);
  const overBudgetCategories = groupedSpending.filter((item) => item.spent > item.budget).length;
  const dailyBars = [38, 22, 46, 66, 31, 54, 82, 43, 61, 47, 72, 56];

  const handleAddExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Add a clear expense name and a valid amount.");
      return;
    }

    setExpenses((current) => [{ id: `expense-${Date.now()}`, title: form.title.trim(), category: form.category, amount, date: form.date, payment: form.payment }, ...current]);
    setShowAddExpense(false);
    setForm({ title: "", category: "Food & mess", amount: "", date: "2026-08-10", payment: "UPI" });
    toast.success("Expense added to your August ledger");
  };

  const deleteExpense = (id: string) => {
    const expense = expenses.find((item) => item.id === id);
    setExpenses((current) => current.filter((item) => item.id !== id));
    setActiveTransaction(null);
    toast.success(`${expense?.title || "Expense"} removed`);
  };

  const saveBudget = (nextPlan: BudgetPlan) => {
    setBudgetPlan(nextPlan);
    setShowBudget(false);
    toast.success("Your August budget is updated");
  };

  const markBillPaid = (bill: Bill) => {
    setBills((current) => current.map((item) => item.id === bill.id ? { ...item, paid: true } : item));
    setExpenses((current) => {
      if (current.some((expense) => expense.id === `bill-${bill.id}`)) return current;
      return [{ id: `bill-${bill.id}`, title: bill.title, category: bill.category, amount: bill.amount, date: bill.date, payment: "UPI" }, ...current];
    });
    toast.success(`${bill.title} marked paid and added to your ledger`);
  };

  const deleteBill = (id: string) => {
    setBills((current) => current.filter((bill) => bill.id !== id));
    toast.success("Upcoming bill removed");
  };

  const addBill = (bill: Omit<Bill, "id" | "paid">) => {
    setBills((current) => [...current, { ...bill, id: `bill-${Date.now()}`, paid: false }]);
    toast.success("Bill added to your upcoming list");
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
      eyebrow="PERSONAL FINANCE · AUGUST 2026"
      title="Campus Cashflow"
      subtitle="Your hostel life, spending, subscriptions, and savings—kept in one calm, clear ledger."
      actions={
        <>
          <button type="button" onClick={() => toast.success("Your August snapshot is ready for export.")} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer">
            <Icon name="download" className="h-3.5 w-3.5" /> Export
          </button>
          <button type="button" onClick={() => setShowBudget(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] cursor-pointer">
            <Icon name="wallet" className="h-3.5 w-3.5" /> Set budget
          </button>
          <button type="button" onClick={() => setShowAddExpense(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[var(--text-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--bg-card)] shadow-sm transition hover:opacity-90 cursor-pointer">
            <Icon name="plus" className="h-3.5 w-3.5" /> Add expense
          </button>
        </>
      }
    >
      <div className="finance-page mx-auto w-full max-w-[1450px] pb-8">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)]">
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] shadow-[var(--shadow-soft)]">
            <div className="relative overflow-hidden bg-[var(--text-primary)] px-5 py-5 text-[var(--bg-card)] sm:px-6 sm:py-6">
              <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border border-white/15" />
              <div className="absolute right-16 top-16 h-24 w-24 rounded-full border border-white/10" />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold tracking-[0.16em] text-white/55 uppercase"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Your August allowance</div>
                  <p className="text-3xl font-semibold tracking-[-0.045em] sm:text-[38px]">{formatINR(remaining)}</p>
                  <p className="mt-1 text-xs font-medium text-white/65">left to spend from {formatINR(monthlyAllowance)}</p>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2.5 backdrop-blur-sm">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-white/10 text-[var(--accent)]"><Icon name="wallet" className="h-4 w-4" /></span>
                  <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50">Next allowance</p><p className="mt-0.5 text-xs font-semibold">21 Aug · 14 days</p></div>
                </div>
              </div>
              <div className="relative mt-7">
                <div className="mb-2 flex items-center justify-between text-[11px] font-semibold"><span className="text-white/60">{formatINR(spending)} committed</span><span>{spendingPercent}% used</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15"><motion.div initial={{ width: 0 }} animate={{ width: `${spendingPercent}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-[var(--accent)]" /></div>
              </div>
            </div>
            <div className="grid divide-y divide-[var(--border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <Metric icon="trend" label="Monthly spend" value={formatINR(spending)} note="All hostel essentials included" />
              <Metric icon="calendar" label="Daily runway" value={formatINR(Math.floor(remaining / 14))} note="Comfortable daily guide" />
              <Metric icon="lightning" label="Spending status" value="On track" note="Core bills are covered" success />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-tight)] sm:p-6">
            <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-full bg-[var(--mint-soft)] opacity-80" />
            <div className="relative flex items-center justify-between"><div><p className="section-label">SMART NOTE</p><h2 className="mt-1.5 text-base font-semibold tracking-tight text-[var(--text-primary)]">Your money, in context</h2></div><span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--mint-soft)] text-[var(--mint)]"><Icon name="sparkles" /></span></div>
            <div className="relative mt-5 rounded-lg border border-[var(--mint)]/15 bg-[var(--mint-soft)] p-3.5">
              <p className="text-xs font-semibold leading-5 text-[var(--text-primary)]">You&apos;ve allocated {formatINR(spending)} across the things that matter.</p>
              <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">Your biggest bucket is {mostUsed?.category.toLowerCase()} at {formatINR(mostUsed?.spent || 0)}. That&apos;s normal for hostel month-start spending.</p>
            </div>
            <div className="relative mt-4 flex items-center gap-3 text-[11px] font-medium text-[var(--text-secondary)]"><span className={`grid h-7 w-7 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] ${overBudgetCategories ? "text-[var(--danger)]" : "text-[var(--success)]"}`}><Icon name={overBudgetCategories ? "lightning" : "check"} className="h-3.5 w-3.5" /></span>{overBudgetCategories ? `${overBudgetCategories} category needs a budget check` : "No category is over its planned cap"}</div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.95fr)]">
          <div className="surface overflow-hidden p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="section-label">SPENDING PULSE</p><h2 className="mt-1.5 text-base font-semibold tracking-tight text-[var(--text-primary)]">A calmer month, one day at a time</h2><p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">See the pattern—not just the total.</p></div><span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">This month</span></div>
            <div className="mt-6 grid h-[146px] grid-cols-12 items-end gap-1.5 border-b border-[var(--border)] px-1 sm:gap-2">
              {dailyBars.map((height, index) => <motion.div key={index} initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ delay: 0.1 + index * 0.025, duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className={`min-h-1 rounded-t-sm ${index === 6 ? "bg-[var(--accent)]" : index > 7 ? "bg-[var(--mint)]/55" : "bg-[var(--border-strong)]/70"}`} />)}
            </div>
            <div className="mt-3 flex justify-between px-1 text-[10px] font-medium text-[var(--text-faint)]"><span>01 Aug</span><span>Week 2</span><span>Today</span></div>
            <div className="mt-5 flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> Hostel fee paid</span><span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--mint)]" /> You&apos;re within budget</span></div>
          </div>

          <div className="surface p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="section-label">UP NEXT</p><h2 className="mt-1.5 text-base font-semibold tracking-tight text-[var(--text-primary)]">Small bills, no surprises</h2></div><button type="button" onClick={() => setShowBills(true)} className="focus-ring text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer">Manage</button></div>
            <div className="mt-4 divide-y divide-[var(--border)]">
              {upcomingBills.length ? upcomingBills.slice(0, 3).map((bill) => <UpcomingBill key={bill.id} bill={bill} />) : <div className="py-8 text-center text-[11px] font-medium text-[var(--text-secondary)]">No upcoming bills. You&apos;re clear for now.</div>}
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11, duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="mt-4 grid gap-4 xl:grid-cols-[minmax(360px,0.82fr)_minmax(0,1.48fr)]">
          <div className="surface p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><p className="section-label">YOUR ENVELOPES</p><h2 className="mt-1.5 text-base font-semibold tracking-tight text-[var(--text-primary)]">Every rupee has a job</h2></div><span className="text-[10px] font-semibold text-[var(--text-secondary)]">{formatINR(monthlyAllowance)} plan</span></div>
            <div className="mt-5 space-y-3.5">
              {groupedSpending.slice(0, 6).map(({ category, spent, budget, icon, color, soft }) => {
                const percentage = Math.min(100, Math.round((spent / budget) * 100));
                return <div key={category}>
                  <div className="mb-1.5 flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span style={{ background: soft, color }} className="grid h-6 w-6 place-items-center rounded-md"><Icon name={icon} className="h-3 w-3" /></span><span className="truncate text-[11px] font-semibold text-[var(--text-primary)]">{category}</span></div><span className="shrink-0 text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]">{formatINR(spent)} <span className="text-[var(--text-faint)]">/ {formatINR(budget)}</span></span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--track)]"><div style={{ width: `${percentage}%`, background: color }} className="h-full rounded-full transition-[width] duration-500" /></div>
                </div>;
              })}
            </div>
            <button type="button" onClick={() => setShowBudget(true)} className="focus-ring mt-5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer">Review monthly plan <Icon name="arrow" className="h-3.5 w-3.5" /></button>
          </div>

          <div className="surface overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="section-label">LIVE LEDGER</p><h2 className="mt-1.5 text-base font-semibold tracking-tight text-[var(--text-primary)]">Recent expenses</h2></div><div className="flex items-center gap-2"><button type="button" onClick={() => setShowAll((value) => !value)} className="focus-ring rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer">{showAll ? "Show recent" : `View all (${expenses.length})`}</button><button type="button" onClick={() => setShowAddExpense(true)} className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-[var(--accent-hover)] cursor-pointer"><Icon name="plus" className="h-3.5 w-3.5" /> Add</button></div></div>
            <div className="divide-y divide-[var(--border)]">
              {visibleExpenses.map((expense) => {
                const meta = categoryMeta[expense.category];
                return <div key={expense.id} className="group relative flex items-center gap-3 px-5 py-3.5 transition hover:bg-[var(--bg-elevated)]/60 sm:px-6"><span style={{ background: meta.soft, color: meta.color }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"><Icon name={meta.icon} className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[var(--text-primary)]">{expense.title}</p><p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{expense.category} · {shortDate(expense.date)}</p></div><PaymentMark method={expense.payment} /><span className="w-16 text-right text-xs font-semibold tabular-nums text-[var(--text-primary)]">−{formatINR(expense.amount)}</span><button type="button" onClick={() => setActiveTransaction(activeTransaction === expense.id ? null : expense.id)} aria-label={`Options for ${expense.title}`} className="focus-ring grid h-7 w-7 place-items-center rounded-md text-[var(--text-faint)] opacity-100 transition hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"><Icon name="more" className="h-4 w-4" /></button>{activeTransaction === expense.id && <div className="absolute right-5 top-11 z-10 w-32 rounded-md border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-[var(--shadow-soft)]"><button type="button" onClick={() => deleteExpense(expense.id)} className="focus-ring flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[10px] font-semibold text-[var(--danger)] hover:bg-[var(--danger-soft)] cursor-pointer"><Icon name="trash" className="h-3.5 w-3.5" /> Delete expense</button></div>}</div>;
              })}
            </div>
          </div>
        </motion.section>
      </div>

      <AnimatePresence>
        {showAddExpense && <ExpenseModal form={form} onChange={setForm} onClose={() => setShowAddExpense(false)} onSubmit={handleAddExpense} />}
        {showBudget && <BudgetModal budgetPlan={budgetPlan} onClose={() => setShowBudget(false)} onSave={saveBudget} />}
        {showBills && <BillsModal bills={bills} onClose={() => setShowBills(false)} onMarkPaid={markBillPaid} onDelete={deleteBill} onAdd={addBill} />}
      </AnimatePresence>
    </AppShell>
  );
}

function Metric({ icon, label, value, note, success = false }: { icon: IconName; label: string; value: string; note: string; success?: boolean }) {
  return <div className="flex min-w-0 items-center gap-3 px-5 py-4 sm:px-5"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${success ? "bg-[var(--mint-soft)] text-[var(--mint)]" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"}`}><Icon name={icon} className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-faint)]">{label}</p><p className="mt-0.5 truncate text-sm font-semibold tracking-tight text-[var(--text-primary)]">{value}</p><p className="mt-0.5 truncate text-[10px] font-medium text-[var(--text-secondary)]">{note}</p></div></div>;
}

function UpcomingBill({ bill }: { bill: Bill }) {
  const meta = categoryMeta[bill.category];
  return <div className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"><span style={{ color: meta.color, background: meta.soft }} className="grid h-8 w-8 place-items-center rounded-md"><Icon name={meta.icon} className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[var(--text-primary)]">{bill.title}</p><p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)]">Due {shortDate(bill.date)}</p></div><span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">{formatINR(bill.amount)}</span></div>;
}

function BudgetModal({ budgetPlan, onClose, onSave }: { budgetPlan: BudgetPlan; onClose: () => void; onSave: (plan: BudgetPlan) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [draft, setDraft] = useState<BudgetPlan>({ allowance: budgetPlan.allowance, caps: { ...budgetPlan.caps } });
  const plannedTotal = categoryOrder.reduce((total, category) => total + (Number(draft.caps[category]) || 0), 0);
  const unallocated = draft.allowance - plannedTotal;

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
      toast.error("Your category caps are higher than your monthly allowance.");
      return;
    }
    onSave(draft);
  };

  if (!mounted) return null;

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md overflow-y-auto sm:p-6">
      <motion.form initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} onMouseDown={(event) => event.stopPropagation()} onSubmit={handleSave} role="dialog" aria-modal="true" aria-labelledby="budget-title" className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="section-label">AUGUST PLAN</p><h2 id="budget-title" className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Set your monthly budget</h2><p className="mt-1 text-[11px] font-medium leading-5 text-[var(--text-secondary)]">Give your allowance a home before the month decides for you.</p></div><button type="button" onClick={onClose} className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer" aria-label="Close"><span className="text-base leading-none">×</span></button></div>
        <label className="mt-5 grid gap-1.5 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-4"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Total monthly allowance</span><div className="flex items-center gap-1"><span className="text-xl font-semibold text-[var(--text-secondary)]">₹</span><input required min="1" type="number" value={draft.allowance} onChange={(event) => setDraft((current) => ({ ...current, allowance: Math.max(0, Number(event.target.value) || 0) }))} className="w-full bg-transparent text-2xl font-semibold tracking-tight text-[var(--text-primary)] outline-none" /></div></label>
        <div className="mt-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-[var(--text-primary)]">Category caps</p><p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)]">Set a realistic maximum for each part of student life.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${unallocated < 0 ? "bg-[var(--danger-soft)] text-[var(--danger)]" : "bg-[var(--mint-soft)] text-[var(--mint)]"}`}>{unallocated < 0 ? `${formatINR(Math.abs(unallocated))} over` : `${formatINR(unallocated)} free`}</span></div>
          <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-3">{categoryOrder.map((category) => { const meta = categoryMeta[category]; return <label key={category} className="flex items-center gap-3 py-2.5"><span style={{ background: meta.soft, color: meta.color }} className="grid h-7 w-7 place-items-center rounded-md"><Icon name={meta.icon} className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1 text-[11px] font-semibold text-[var(--text-primary)]">{category}</span><span className="text-xs font-semibold text-[var(--text-secondary)]">₹</span><input min="0" type="number" value={draft.caps[category]} onChange={(event) => updateCap(category, event.target.value)} className="w-20 bg-transparent text-right text-xs font-semibold tabular-nums text-[var(--text-primary)] outline-none" /></label>; })}</div>
        </div>
        <div className="mt-5 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-[11px]"><span className="font-medium text-[var(--text-secondary)]">Allocated to categories</span><span className="font-semibold tabular-nums text-[var(--text-primary)]">{formatINR(plannedTotal)}</span></div>
        <div className="mt-5 flex justify-end gap-2.5"><button type="button" onClick={onClose} className="focus-ring rounded-lg border border-[var(--border)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer">Cancel</button><button type="submit" className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 cursor-pointer"><Icon name="check" className="h-3.5 w-3.5" /> Save budget</button></div>
      </motion.form>
    </motion.div>,
    document.body
  );
}

function BillsModal({ bills, onClose, onMarkPaid, onDelete, onAdd }: { bills: Bill[]; onClose: () => void; onMarkPaid: (bill: Bill) => void; onDelete: (id: string) => void; onAdd: (bill: Omit<Bill, "id" | "paid">) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", date: "2026-08-20", amount: "", category: "Subscriptions" as Category });
  const sortedBills = [...bills].sort((a, b) => Number(a.paid) - Number(b.paid) || a.date.localeCompare(b.date));

  const submitBill = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(draft.amount);
    if (!draft.title.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Add a bill name and a valid amount.");
      return;
    }
    onAdd({ title: draft.title.trim(), date: draft.date, amount, category: draft.category });
    setDraft({ title: "", date: "2026-08-20", amount: "", category: "Subscriptions" });
    setAdding(false);
  };

  if (!mounted) return null;

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md overflow-y-auto sm:p-6">
      <motion.div initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="bills-title" className="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="section-label">PAYMENT CALENDAR</p><h2 id="bills-title" className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Manage small bills</h2><p className="mt-1 text-[11px] font-medium leading-5 text-[var(--text-secondary)]">Mark something paid and it will also land in your expense ledger.</p></div><button type="button" onClick={onClose} className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer" aria-label="Close"><span className="text-base leading-none">×</span></button></div>
        <div className="mt-5 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-3">{sortedBills.length ? sortedBills.map((bill) => { const meta = categoryMeta[bill.category]; return <div key={bill.id} className={`flex items-center gap-3 py-3 ${bill.paid ? "opacity-55" : ""}`}><span style={{ background: meta.soft, color: meta.color }} className="grid h-8 w-8 shrink-0 place-items-center rounded-md"><Icon name={meta.icon} className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[var(--text-primary)]">{bill.title}</p><p className="mt-0.5 text-[10px] font-medium text-[var(--text-secondary)]">{bill.paid ? "Paid" : `Due ${shortDate(bill.date)}`} · {bill.category}</p></div><span className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">{formatINR(bill.amount)}</span>{bill.paid ? <span className="rounded-md bg-[var(--mint-soft)] px-2 py-1 text-[9px] font-bold text-[var(--mint)]">PAID</span> : <button type="button" onClick={() => onMarkPaid(bill)} className="focus-ring rounded-md bg-[var(--text-primary)] px-2 py-1.5 text-[9px] font-bold text-[var(--bg-card)] hover:opacity-90 cursor-pointer">Mark paid</button>}<button type="button" onClick={() => onDelete(bill.id)} className="focus-ring grid h-7 w-7 place-items-center rounded-md text-[var(--text-faint)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] cursor-pointer" aria-label={`Remove ${bill.title}`}><Icon name="trash" className="h-3.5 w-3.5" /></button></div>; }) : <div className="py-10 text-center text-[11px] font-medium text-[var(--text-secondary)]">No bills yet. Add any recurring payment you want to remember.</div>}</div>
        <div className="mt-4">{adding ? <form onSubmit={submitBill} className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-3"><div className="grid gap-2 sm:grid-cols-[1fr_100px]"><input autoFocus required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Bill name" className="app-input h-9 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2.5 text-xs font-medium text-[var(--text-primary)]" /><div className="flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2"><span className="text-xs text-[var(--text-secondary)]">₹</span><input required min="1" type="number" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="Amount" className="min-w-0 flex-1 bg-transparent pl-1 text-xs font-semibold text-[var(--text-primary)] outline-none" /></div></div><div className="mt-2 grid grid-cols-2 gap-2"><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="app-input h-9 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 text-[11px] font-medium text-[var(--text-primary)]" /><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Category })} className="app-input h-9 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-2 text-[11px] font-medium text-[var(--text-primary)]">{categoryOrder.map((category) => <option key={category}>{category}</option>)}</select></div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setAdding(false)} className="focus-ring px-2 text-[10px] font-semibold text-[var(--text-secondary)] cursor-pointer">Cancel</button><button type="submit" className="focus-ring rounded-md bg-[var(--text-primary)] px-2.5 py-1.5 text-[10px] font-semibold text-[var(--bg-card)] cursor-pointer">Add bill</button></div></form> : <button type="button" onClick={() => setAdding(true)} className="focus-ring inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)] hover:underline cursor-pointer"><Icon name="plus" className="h-3.5 w-3.5" /> Add a bill</button>}</div>
        <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="focus-ring rounded-lg border border-[var(--border)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer">Done</button></div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function ExpenseModal({ form, onChange, onClose, onSubmit }: { form: { title: string; category: Category; amount: string; date: string; payment: Expense["payment"] }; onChange: (form: { title: string; category: Category; amount: string; date: string; payment: Expense["payment"] }) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md overflow-y-auto sm:p-6">
      <motion.form initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} onMouseDown={(event) => event.stopPropagation()} onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="expense-title" className="my-auto w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><p className="section-label">NEW ENTRY</p><h2 id="expense-title" className="mt-1.5 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Add an expense</h2><p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">A little logging now means less money stress later.</p></div><button type="button" onClick={onClose} className="focus-ring grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer" aria-label="Close"><span className="text-base leading-none">×</span></button></div>
        <div className="mt-5 grid gap-4"><label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">What did you pay for?</span><input autoFocus required value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="e.g. Mess top-up" className="app-input h-10 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)] placeholder:text-[var(--text-faint)]" /></label>
          <div className="grid grid-cols-[1fr_120px] gap-3"><label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Category</span><select value={form.category} onChange={(event) => onChange({ ...form, category: event.target.value as Category })} className="app-input h-10 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]">{categoryOrder.map((category) => <option key={category}>{category}</option>)}</select></label><label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Amount</span><div className="flex h-10 items-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3"><span className="text-xs font-semibold text-[var(--text-secondary)]">₹</span><input required inputMode="decimal" min="1" type="number" value={form.amount} onChange={(event) => onChange({ ...form, amount: event.target.value })} placeholder="0" className="min-w-0 flex-1 bg-transparent pl-1 text-xs font-semibold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-faint)]" /></div></label></div>
          <div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Date</span><input type="date" value={form.date} onChange={(event) => onChange({ ...form, date: event.target.value })} className="app-input h-10 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]" /></label><label className="grid gap-1.5"><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Paid with</span><select value={form.payment} onChange={(event) => onChange({ ...form, payment: event.target.value as Expense["payment"] })} className="app-input h-10 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-primary)]"><option>UPI</option><option>Cash</option><option>Card</option></select></label></div>
        </div>
        <div className="mt-6 flex justify-end gap-2.5"><button type="button" onClick={onClose} className="focus-ring rounded-lg border border-[var(--border)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer">Cancel</button><button type="submit" className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3.5 py-2 text-xs font-semibold text-[var(--bg-card)] hover:opacity-90 cursor-pointer"><Icon name="plus" className="h-3.5 w-3.5" /> Add to ledger</button></div>
      </motion.form>
    </motion.div>,
    document.body
  );
}
