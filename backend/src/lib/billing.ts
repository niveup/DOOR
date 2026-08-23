/**
 * Bill payment mutation, extracted from server.ts so the money path is
 * unit-testable. GA-103: an unknown bill id returns 404 and mutates nothing —
 * the old findFirst({ OR: [{ id }, { paid: false }] }) fallback that paid an
 * arbitrary unpaid bill is deliberately gone.
 */

export interface PayableBill {
  id: string;
  title: string;
  category: string;
  amount: number;
}

export interface BillModel {
  findUnique(args: { where: { id: string } }): Promise<PayableBill | null>;
  update(args: { where: { id: string }; data: { paid: boolean } }): Promise<unknown>;
}

export interface ExpenseModel {
  upsert(args: {
    where: { id: string };
    update: { title: string; category: string; amount: number; date: string; payment: string };
    create: { id: string; title: string; category: string; amount: number; date: string; payment: string };
  }): Promise<unknown>;
}

export type PayBillResult =
  | { ok: true; bill: unknown; expense: unknown }
  | { ok: false; status: 404; error: string };

export async function payBillById(
  bill: BillModel,
  expense: ExpenseModel,
  id: string,
  paymentDate: string
): Promise<PayBillResult> {
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
}
