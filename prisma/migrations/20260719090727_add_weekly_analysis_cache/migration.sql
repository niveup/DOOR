-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "analysisStale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "analysisWeekOf" DATE,
ADD COLUMN     "weeklyAnalysis" TEXT;
