-- CreateTable
CREATE TABLE "StudyLog" (
    "id" TEXT NOT NULL,
    "logDate" TEXT NOT NULL,
    "timeBlock" TEXT NOT NULL DEFAULT 'Evening',
    "subjectId" INTEGER NOT NULL,
    "subjectName" TEXT NOT NULL,
    "hoursStudied" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "questionsSolved" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyLog_logDate_idx" ON "StudyLog"("logDate");

-- CreateIndex
CREATE INDEX "StudyLog_subjectId_idx" ON "StudyLog"("subjectId");

-- AddForeignKey
ALTER TABLE "StudyLog" ADD CONSTRAINT "StudyLog_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("subjectId") ON DELETE CASCADE ON UPDATE CASCADE;
