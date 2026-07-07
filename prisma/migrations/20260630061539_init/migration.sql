-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "targetExam" TEXT NOT NULL DEFAULT 'GATE',
    "targetYear" INTEGER NOT NULL DEFAULT 2027,
    "dailyAvailableHours" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'hinglish',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "wakeTime" TEXT NOT NULL DEFAULT '06:00',
    "sleepTime" TEXT NOT NULL DEFAULT '22:00',
    "exerciseGoal" TEXT,
    "otherGoals" JSONB,
    "prepLevel" TEXT NOT NULL DEFAULT 'Beginner',
    "scoreWeights" JSONB,
    "pushSubscription" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "subjectId" INTEGER NOT NULL,
    "subjectName" TEXT NOT NULL,
    "importanceLevel" DOUBLE PRECISION NOT NULL,
    "topics" JSONB NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("subjectId")
);

-- CreateTable
CREATE TABLE "Journal" (
    "journalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "entryText" TEXT NOT NULL,
    "mood" TEXT,
    "tags" JSONB,
    "aiFeedback" TEXT,
    "tomorrowTask" TEXT,
    "patternDetected" TEXT,
    "studyDone" BOOLEAN NOT NULL DEFAULT false,
    "exerciseDone" BOOLEAN NOT NULL DEFAULT false,
    "readingDone" BOOLEAN NOT NULL DEFAULT false,
    "helpfulness" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("journalId")
);

-- CreateTable
CREATE TABLE "RoutinePlan" (
    "planId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "greeting" TEXT NOT NULL,
    "planText" TEXT NOT NULL,
    "mainPriority" TEXT NOT NULL,
    "totalEstimatedMin" INTEGER NOT NULL DEFAULT 0,
    "isWeekend" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutinePlan_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "Task" (
    "taskId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "subjectId" INTEGER,
    "topicId" TEXT,
    "durationMin" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT',
    "isPriority" BOOLEAN NOT NULL DEFAULT false,
    "isCarryover" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("taskId")
);

-- CreateTable
CREATE TABLE "ProgressRating" (
    "ratingId" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "selfRating" INTEGER NOT NULL,
    "hoursStudied" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "questionsSolved" INTEGER NOT NULL DEFAULT 0,
    "confidenceLevel" INTEGER NOT NULL DEFAULT 3,
    "revisionStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "aiRecommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressRating_pkey" PRIMARY KEY ("ratingId")
);

-- CreateTable
CREATE TABLE "TopicStatus" (
    "topicStatusId" TEXT NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "topicId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "lastExplanationId" TEXT,
    "lastScore" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicStatus_pkey" PRIMARY KEY ("topicStatusId")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "reportId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "avgDailyScore" DOUBLE PRECISION NOT NULL,
    "totalStudyHours" DOUBLE PRECISION NOT NULL,
    "completedTasks" INTEGER NOT NULL,
    "missedTasks" INTEGER NOT NULL,
    "streaksSummary" JSONB NOT NULL,
    "biggestImprovement" TEXT NOT NULL,
    "biggestProblem" TEXT NOT NULL,
    "aiSummary" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("reportId")
);

-- CreateTable
CREATE TABLE "AiCallLog" (
    "logId" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "promptPreview" TEXT,
    "responsePreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("logId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Journal_date_key" ON "Journal"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RoutinePlan_date_key" ON "RoutinePlan"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ProgressRating_subjectId_weekStartDate_key" ON "ProgressRating"("subjectId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "TopicStatus_subjectId_topicId_key" ON "TopicStatus"("subjectId", "topicId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReport_weekStartDate_key" ON "WeeklyReport"("weekStartDate");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_planId_fkey" FOREIGN KEY ("planId") REFERENCES "RoutinePlan"("planId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("subjectId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressRating" ADD CONSTRAINT "ProgressRating_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicStatus" ADD CONSTRAINT "TopicStatus_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("subjectId") ON DELETE RESTRICT ON UPDATE CASCADE;
