ALTER TABLE "InterviewAttempt"
ALTER COLUMN "score" TYPE DOUBLE PRECISION USING "score"::DOUBLE PRECISION;

CREATE UNIQUE INDEX "InterviewAttempt_sessionId_questionIndex_key"
ON "InterviewAttempt"("sessionId", "questionIndex");

CREATE INDEX "InterviewAttempt_sessionId_createdAt_idx"
ON "InterviewAttempt"("sessionId", "createdAt");
