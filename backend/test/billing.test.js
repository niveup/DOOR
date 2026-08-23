import { test } from "node:test";
import assert from "node:assert/strict";
import { payBillById } from "../src/lib/billing.ts";

function makeModels(existingBill) {
  const calls = [];
  const bill = {
    findUnique: async ({ where }) => (existingBill && existingBill.id === where.id ? existingBill : null),
    update: async (args) => { calls.push(["bill.update", args.where.id, args.data.paid]); return { ...existingBill, paid: true }; },
  };
  const expense = {
    upsert: async (args) => { calls.push(["expense.upsert", args.where.id, args.create.date]); return { id: args.where.id }; },
  };
  return { bill, expense, calls };
}

const BILL = { id: "b-1", title: "Hostel fee", category: "Subscriptions", amount: 1200 };

test("payBillById marks the bill paid and books the deterministic expense", async () => {
  const { bill, expense, calls } = makeModels(BILL);
  const result = await payBillById(bill, expense, "b-1", "2026-08-22");

  assert.equal(result.ok, true);
  assert.deepEqual(calls[0], ["bill.update", "b-1", true]);
  assert.deepEqual(calls[1], ["expense.upsert", "bill-b-1", "2026-08-22"]);
});

test("payBillById returns 404 for an unknown id and mutates nothing", async () => {
  const { bill, expense, calls } = makeModels(BILL);
  const result = await payBillById(bill, expense, "does-not-exist", "2026-08-22");

  assert.deepEqual(result, { ok: false, status: 404, error: "Bill not found." });
  assert.deepEqual(calls, []); // regression guard: the old arbitrary-bill fallback is gone
});

test("payBillById does not fall back to another unpaid bill", async () => {
  // even when OTHER unpaid bills exist in the table, an unknown id must not pay them
  const otherUnpaid = { id: "b-other", title: "WiFi", category: "Others", amount: 400 };
  const { bill, expense, calls } = makeModels(otherUnpaid);
  const result = await payBillById(bill, expense, "wrong-id", "2026-08-22");

  assert.equal(result.ok, false);
  assert.deepEqual(calls, []);
});
