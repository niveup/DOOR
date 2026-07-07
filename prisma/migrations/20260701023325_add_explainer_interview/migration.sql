-- CreateTable
CREATE TABLE "ConceptExplanation" (
    "explanationId" TEXT NOT NULL,
    "topicInput" TEXT NOT NULL,
    "normalizedTopic" TEXT NOT NULL,
    "subjectId" INTEGER,
    "mode" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'Medium',
    "explanationText" TEXT NOT NULL,
    "questions" JSONB,
    "finalScore" INTEGER,
    "topicStatusSet" BOOLEAN NOT NULL DEFAULT false,
    "formulaGuardPassed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptExplanation_pkey" PRIMARY KEY ("explanationId")
);

-- CreateTable
CREATE TABLE "InterviewAttempt" (
    "attemptId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "questionText" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL,
    "dimensions" JSONB,
    "missingPoints" JSONB,
    "improvedAnswer" TEXT,
    "improvedAnswerViewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewAttempt_pkey" PRIMARY KEY ("attemptId")
);

-- AddForeignKey
ALTER TABLE "ConceptExplanation" ADD CONSTRAINT "ConceptExplanation_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("subjectId") ON DELETE SET NULL ON UPDATE CASCADE;
