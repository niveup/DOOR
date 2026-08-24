-- Money amounts: float -> fixed decimal (audit F-DB-2 / GA-117)
-- Cast performs banker-safe rounding to 2 dp on existing rows.

-- AlterTable
ALTER TABLE "FinanceExpense" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "FinanceBudget" ALTER COLUMN "allowance" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "FinanceBill" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);
