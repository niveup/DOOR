/**
 * Bill payment mutation, extracted from server.ts so the money path is
 * unit-testable and ACID transaction-wrapped (GA-103, GA-120).
 *
 * GA-103: an unknown bill id returns 404 and mutates nothing.
 * GA-120: bill marking (paid: true) and auto-ledger expense creation execute
 * inside an atomic Prisma $transaction so a crash or error never leaves a
 * paid bill without an expense record.
 */

export interface PayableBill {
  id: string;
  title: string;
  category: string;
  amount: number | any;
}

export interface BillModel {
  findUnique(args: { where: { id: string } }): Promise<PayableBill | null>;
  update(args: { where: { id: string }; data: { paid: boolean } }): Promise<unknown>;
}

export interface ExpenseModel {
  upsert(args: {
    where: { id: string };
    update: { title: string; category: string; amount: number | any; date: string; payment: string };
    create: { id: string; title: string; category: string; amount: number | any; date: string; payment: string };
  }): Promise<unknown>;
}

export interface TransactionalContext {
  financeBill?: BillModel;
  financeExpense?: ExpenseModel;
  FinanceBill?: BillModel;
  FinanceExpense?: ExpenseModel;
  bill?: BillModel;
  expense?: ExpenseModel;
  [key: string]: any;
}

export interface TransactionalClient {
  $transaction<T>(fn: (tx: TransactionalContext) => Promise<T>): Promise<T>;
}

export type PayBillResult =
  | { ok: true; bill: unknown; expense: unknown }
  | { ok: false; status: 404; error: string };

function resolveDelegates(context: TransactionalContext) {
  const bill = context.financeBill || context.FinanceBill || context.bill;
  const expense = context.financeExpense || context.FinanceExpense || context.expense;
  return { bill, expense };
}

export async function payBillById(
  client: TransactionalClient,
  id: string,
  paymentDate: string
): Promise<PayBillResult> {
  return client.$transaction(async (tx) => {
    const { bill, expense } = resolveDelegates(tx);
    if (!bill || !expense) {
      throw new Error("Billing models are unavailable in transaction context.");
    }

    const target = await bill.findUnique({ where: { id } });
    if (!target) {
      return { ok: false, status: 404, error: "Bill not found." };
    }

    const updatedBill = await bill.update({
      where: { id: target.id },
      data: { paid: true },
    });

    const expenseId = `bill-${target.id}`;
    const createdExpense = await expense.upsert({
      where: { id: expenseId },
      update: {
        title: target.title,
        category: target.category,
        amount: target.amount,
        date: paymentDate,
        payment: "UPI",
      },
      create: {
        id: expenseId,
        title: target.title,
        category: target.category,
        amount: target.amount,
        date: paymentDate,
        payment: "UPI",
      },
    });

    return { ok: true, bill: updatedBill, expense: createdExpense };
  });
}
