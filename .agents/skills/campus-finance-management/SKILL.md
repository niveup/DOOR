---
name: campus-finance-management
description: >-
  Guide and reference architecture for the Campus Cashflow personal finance module in DOOR.
  Use this skill when maintaining, extending, or refactoring the finance page, budget planning,
  expense logging, or bill tracking features.
---

# Campus Finance Management Skill

This skill documents the architecture, data models, UX flows, and maintenance guidelines for the **Campus Cashflow** personal finance module located at [`frontend/app/finance/page.tsx`](file:///d:/DOOR/frontend/app/finance/page.tsx).

---

## 1. Overview & Concept

**Campus Cashflow** is a student-centric personal finance ledger designed for college and hostel life. It helps students track monthly allowances, budget across hostel essentials, monitor upcoming recurring bills, and log daily expenses within the Indian financial ecosystem (INR currency `₹`, UPI / Cash / Card payment modes).

---

## 2. File Location & Core Types

* **Main Page Component**: [`frontend/app/finance/page.tsx`](file:///d:/DOOR/frontend/app/finance/page.tsx)

### Core Data Models

```typescript
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
  date: string; // YYYY-MM-DD
  payment: "UPI" | "Cash" | "Card";
};

type BudgetPlan = {
  allowance: number; // e.g. 12000
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
```

---

## 3. Key Features & Business Logic

1. **Allowance & Daily Runway**:
   * Tracks monthly committed spend vs. remaining allowance.
   * Calculates **Daily Runway Guide**: `Math.floor(remaining / remainingDays)` to provide a daily spending limit.
2. **Smart Context Insights**:
   * Dynamically evaluates the user's top spending category.
   * Scans all envelope categories to highlight any cap breaches (`overBudgetCategories`).
3. **Spending Pulse**:
   * Visual bar chart illustrating daily spending patterns over 12 intervals.
4. **Category Envelopes**:
   * Visual progress indicators comparing spent amount vs. assigned budget cap per category.
5. **Live Ledger & Expense Operations**:
   * Supports toggling between top 5 recent expenses vs. all transactions.
   * Deleting individual expenses via dropdown menu options.
6. **Upcoming Bills & Auto-Ledger Transfer**:
   * Displays pending small bills.
   * **Mark Paid Action**: Automatically sets `paid: true` on the bill and inserts a corresponding expense into the live ledger with `payment: "UPI"` to eliminate duplicate entry effort.
7. **Interactive Modals**:
   * `ExpenseModal`: Add new custom expense.
   * `BudgetModal`: Adjust monthly allowance and individual category caps with live allocation/unallocated feedback.
   * `BillsModal`: Manage upcoming bills and add new recurring payments.

---

## 4. State Management & Hydration

* **Local Storage Keys**:
  * `door-finance-expenses`: Array of `Expense`
  * `door-finance-budget`: `BudgetPlan` object
  * `door-finance-bills`: Array of `Bill`
* **Hydration Protection**:
  * Uses an `isLoaded` state flag initialized via `useEffect` timeout to prevent Next.js SSR / client hydration mismatch errors.
  * Seed data (`initialExpenses`, `defaultBudgetPlan`, `initialBills`) serves as default fallbacks.

---

## 5. Styling, Motion & Design System Rules

* **Design Tokens**: Uses CSS variables defined in `globals.css` (e.g. `var(--accent)`, `var(--mint)`, `var(--sun)`, `var(--lavender)`, `var(--danger)`, `var(--bg-card)`).
* **Animations**: Utilizes `motion/react` (`motion.div`, `AnimatePresence`) for modal transitions and animated progress bar fills.
* **Toasts**: Uses `sonner` for action confirmations ("Expense added", "Budget updated").
* **Dark Mode Constraint**: Adhere to project rules in [AGENTS.md](file:///d:/DOOR/.agents/AGENTS.md) — do not apply inline color overrides that bypass dark mode tokens when `data-theme="dark"` is active.

---

## 6. Guidelines for Extending the Finance Module

* **Backend Integration**: If migrating from `localStorage` to server-backed persistence, preserve client-side optimistic UI state and initial seeds as fallback.
* **Localization**: Keep currency calculations aligned with `Intl.NumberFormat("en-IN")` and date formatting with `Intl.DateTimeFormat("en-IN")`.
* **Bill-to-Expense Pipeline**: Any feature that touches bill payment status must maintain the auto-ledger insertion pattern (`id: bill-${bill.id}`).
