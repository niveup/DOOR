import { test } from "node:test";
import assert from "node:assert/strict";
import { payBillById } from "../src/lib/billing.ts";

function makeTransactionalClient(existingBill, options = {}) {
  const calls = [];
  const bill = {
    findUnique: async ({ where }) => {
      calls.push(["bill.findUnique", where.id]);
      return existingBill && existingBill.id === where.id ? existingBill : null;
    },
    update: async (args) => {
      calls.push(["bill.update", args.where.id, args.data.paid]);
      return { ...existingBill, paid: true };
    },
  };
  const expense = {
    upsert: async (args) => {
      if (options.failExpense) {
        throw new Error("Simulated expense write failure");
      }
      calls.push(["expense.upsert", args.where.id, args.create.date]);
      return { id: args.where.id };
    },
  };

  const client = {
    $transaction: async (callback) => {
      calls.push(["$transaction.begin"]);
      try {
        const result = await callback({ financeBill: bill, financeExpense: expense });
        calls.push(["$transaction.commit"]);
        return result;
      } catch (err) {
        calls.push(["$transaction.rollback"]);
        throw err;
      }
    },
    financeBill: bill,
    financeExpense: expense,
  };

  return { client, bill, expense, calls };
}

const BILL = { id: "b-1", title: "Hostel fee", category: "Subscriptions", amount: 1200 };

test("payBillById executes inside $transaction, marks bill paid and books deterministic expense", async () => {
  const { client, calls } = makeTransactionalClient(BILL);
  const result = await payBillById(client, "b-1", "2026-08-22");

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    ["$transaction.begin"],
    ["bill.findUnique", "b-1"],
    ["bill.update", "b-1", true],
    ["expense.upsert", "bill-b-1", "2026-08-22"],
    ["$transaction.commit"],
  ]);
});

test("payBillById returns 404 for an unknown id and mutates nothing inside transaction", async () => {
  const { client, calls } = makeTransactionalClient(BILL);
  const result = await payBillById(client, "does-not-exist", "2026-08-22");

  assert.deepEqual(result, { ok: false, status: 404, error: "Bill not found." });
  assert.deepEqual(calls, [
    ["$transaction.begin"],
    ["bill.findUnique", "does-not-exist"],
    ["$transaction.commit"],
  ]);
});

test("payBillById does not fall back to another unpaid bill", async () => {
  const otherUnpaid = { id: "b-other", title: "WiFi", category: "Others", amount: 400 };
  const { client, calls } = makeTransactionalClient(otherUnpaid);
  const result = await payBillById(client, "wrong-id", "2026-08-22");

  assert.equal(result.ok, false);
  assert.deepEqual(calls, [
    ["$transaction.begin"],
    ["bill.findUnique", "wrong-id"],
    ["$transaction.commit"],
  ]);
});

test("payBillById rolls back the transaction when expense creation fails", async () => {
  const { client, calls } = makeTransactionalClient(BILL, { failExpense: true });

  await assert.rejects(
    () => payBillById(client, "b-1", "2026-08-22"),
    /Simulated expense write failure/
  );

  assert.deepEqual(calls, [
    ["$transaction.begin"],
    ["bill.findUnique", "b-1"],
    ["bill.update", "b-1", true],
    ["$transaction.rollback"],
  ]);
});
