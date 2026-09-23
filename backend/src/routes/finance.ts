import type { Express, Request, Response } from "express";
import type { PrismaClient } from "@prisma/client";
import { payBillById } from "../lib/billing";
import { getKolkataDateString } from "../lib/time";

/**
 * Finance domain routes, extracted from server.ts (audit GA-114 step 1).
 * Behavior is identical to the inline version: same paths, same validation,
 * same confirm guard on reset, same 180-day window on data reads.
 */
export function registerFinanceRoutes(app: Express, prisma: PrismaClient): void {
  function getFinanceModels(db: any = prisma) {
    const expense = db?.financeExpense || db?.FinanceExpense;
    const budget = db?.financeBudget || db?.FinanceBudget;
    const bill = db?.financeBill || db?.FinanceBill;
    return { expense, budget, bill };
  }

  function toNumericAmount(val: unknown): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return val;
    if (typeof val === "object" && val !== null && "toNumber" in val && typeof (val as any).toNumber === "function") {
      return (val as any).toNumber();
    }
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatExpense(e: any) {
    return e ? { ...e, amount: toNumericAmount(e.amount) } : null;
  }

  function formatBill(b: any) {
    return b ? { ...b, amount: toNumericAmount(b.amount) } : null;
  }

  app.get("/api/finance/data", async (_req: Request, res: Response) => {
    try {
      const { expense, budget, bill } = getFinanceModels();
      // Rolling 180-day window with a hard cap: the finance screen must not
      // grow unbounded (audit A-CODE-15). Older expenses remain in Postgres.
      const cutoff = getKolkataDateString(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000));
      const [expenses, budgetRecord, bills] = await Promise.all([
        expense?.findMany
          ? expense.findMany({ where: { date: { gte: cutoff } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 2000 })
          : Promise.resolve([]),
        budget?.findUnique
          ? budget.findUnique({ where: { id: "default" } })
          : Promise.resolve(null),
        bill?.findMany
          ? bill.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 2000 })
          : Promise.resolve([]),
      ]);

      const defaultCaps = {
        "Hostel & utilities": 0,
        "Food & mess": 0,
        "Travel & commute": 0,
        "Academics": 0,
        "Personal & health": 0,
        "Subscriptions": 0,
        "Fun & social": 0,
        "Others": 0,
      };

      res.json({
        expenses: (expenses || []).map(formatExpense),
        budget: budgetRecord
          ? {
              allowance: toNumericAmount(budgetRecord.allowance),
              caps: budgetRecord.caps || defaultCaps,
            }
          : {
              allowance: 0,
              caps: defaultCaps,
            },
        bills: (bills || []).map(formatBill),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/finance/expense", async (req: Request, res: Response) => {
    try {
      const { id, title, category, amount, date, payment } = req.body;
      const amountNum = Number(amount);
      if (!title || !Number.isFinite(amountNum)) {
        return res.status(400).json({ error: "title and numeric amount are required." });
      }

      const { expense } = getFinanceModels();
      if (!expense) {
        return res.json({ success: true, expense: { id: id || `exp-${Date.now()}`, title, category, amount: amountNum, date, payment } });
      }

      if (id) {
        const updated = await expense.upsert({
          where: { id },
          update: {
            title: String(title).trim(),
            category: String(category || "Others"),
            amount: amountNum,
            date: String(date || getKolkataDateString()),
            payment: String(payment || "UPI"),
          },
          create: {
            id,
            title: String(title).trim(),
            category: String(category || "Others"),
            amount: amountNum,
            date: String(date || getKolkataDateString()),
            payment: String(payment || "UPI"),
          },
        });
        return res.json({ success: true, expense: formatExpense(updated) });
      } else {
        const created = await expense.create({
          data: {
            title: String(title).trim(),
            category: String(category || "Others"),
            amount: amountNum,
            date: String(date || getKolkataDateString()),
            payment: String(payment || "UPI"),
          },
        });
        return res.json({ success: true, expense: formatExpense(created) });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/finance/expense/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Expense ID is required." });
      const { expense } = getFinanceModels();
      if (expense?.deleteMany) {
        await expense.deleteMany({ where: { id } });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/finance/expense", async (req: Request, res: Response) => {
    try {
      const id = req.query.id as string || req.body?.id;
      if (!id) return res.status(400).json({ error: "Expense ID is required." });
      const { expense } = getFinanceModels();
      if (expense?.deleteMany) {
        await expense.deleteMany({ where: { id } });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/finance/budget", async (req: Request, res: Response) => {
    try {
      const { allowance, caps } = req.body;
      const allowanceNum = Number(allowance || 0);
      const { budget } = getFinanceModels();

      if (!budget?.upsert) {
        return res.json({ success: true, budget: { id: "default", allowance: allowanceNum, caps: caps || {} } });
      }

      const updated = await budget.upsert({
        where: { id: "default" },
        update: {
          allowance: allowanceNum,
          caps: caps || {},
        },
        create: {
          id: "default",
          allowance: allowanceNum,
          caps: caps || {},
        },
      });

      res.json({
        success: true,
        budget: {
          ...updated,
          allowance: toNumericAmount(updated.allowance),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/finance/bill", async (req: Request, res: Response) => {
    try {
      const { id, title, date, amount, category, paid } = req.body;
      const amountNum = Number(amount);
      if (!title || !Number.isFinite(amountNum)) {
        return res.status(400).json({ error: "title and numeric amount are required." });
      }

      const { bill } = getFinanceModels();
      if (!bill) {
        return res.json({ success: true, bill: { id: id || `bill-${Date.now()}`, title, date, amount: amountNum, category, paid: Boolean(paid) } });
      }

      if (id) {
        const updated = await bill.upsert({
          where: { id },
          update: {
            title: String(title).trim(),
            date: String(date || getKolkataDateString()),
            amount: amountNum,
            category: String(category || "Subscriptions"),
            paid: Boolean(paid),
          },
          create: {
            id,
            title: String(title).trim(),
            date: String(date || getKolkataDateString()),
            amount: amountNum,
            category: String(category || "Subscriptions"),
            paid: Boolean(paid),
          },
        });
        return res.json({ success: true, bill: formatBill(updated) });
      } else {
        const created = await bill.create({
          data: {
            title: String(title).trim(),
            date: String(date || getKolkataDateString()),
            amount: amountNum,
            category: String(category || "Subscriptions"),
            paid: Boolean(paid),
          },
        });
        return res.json({ success: true, bill: formatBill(created) });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/finance/bill/pay", async (req: Request, res: Response) => {
    try {
      const { id, paymentDate } = req.body;
      if (!id) return res.status(400).json({ error: "Bill ID is required." });

      if (paymentDate !== undefined && (typeof paymentDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate.trim()))) {
        return res.status(400).json({ error: "paymentDate must be YYYY-MM-DD." });
      }

      const { bill, expense } = getFinanceModels(prisma);
      if (!bill || !expense) {
        return res.json({ success: true });
      }

      const effectiveDate = typeof paymentDate === "string" && paymentDate.trim()
        ? paymentDate.trim()
        : getKolkataDateString();

      const result = await payBillById(prisma, id, effectiveDate);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json({ success: true, bill: formatBill(result.bill), expense: formatExpense(result.expense) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/finance/bill/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Bill ID is required." });
      const { bill } = getFinanceModels();
      if (bill?.deleteMany) {
        await bill.deleteMany({ where: { id } });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/finance/bill", async (req: Request, res: Response) => {
    try {
      const id = req.query.id as string || req.body?.id;
      if (!id) return res.status(400).json({ error: "Bill ID is required." });
      const { bill } = getFinanceModels();
      if (bill?.deleteMany) {
        await bill.deleteMany({ where: { id } });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/finance/reset", async (req: Request, res: Response) => {
    try {
      if (req.body?.confirm !== "DELETE") {
        return res.status(400).json({ error: "This wipes the data permanently. Send { \"confirm\": \"DELETE\" } to confirm." });
      }
      const { expense, budget, bill } = getFinanceModels();
      if (expense?.deleteMany) await expense.deleteMany({});
      if (bill?.deleteMany) await bill.deleteMany({});
      if (budget?.deleteMany) await budget.deleteMany({});
      res.json({ success: true, message: "Finance data reset successfully." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
