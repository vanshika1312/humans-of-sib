-- Optional candidate portfolio URL + per-job application questions.

ALTER TABLE "HiringCandidate" ADD COLUMN IF NOT EXISTS "portfolioUrl" VARCHAR(2048);

DO $$ BEGIN
  CREATE TYPE "HiringJobQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'DROPDOWN', 'FILE', 'YES_NO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "HiringJobQuestion" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "prompt" VARCHAR(500) NOT NULL,
  "helpText" VARCHAR(500),
  "type" "HiringJobQuestionType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "optionsJson" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HiringJobQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HiringApplicationQuestionAnswer" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "questionId" TEXT,
  "prompt" VARCHAR(500) NOT NULL,
  "type" "HiringJobQuestionType" NOT NULL,
  "textValue" TEXT,
  "fileUrl" VARCHAR(2048),
  "fileName" VARCHAR(280),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HiringApplicationQuestionAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HiringJobQuestion_jobId_sortOrder_idx" ON "HiringJobQuestion"("jobId", "sortOrder");
CREATE INDEX IF NOT EXISTS "HiringApplicationQuestionAnswer_applicationId_idx" ON "HiringApplicationQuestionAnswer"("applicationId");
CREATE INDEX IF NOT EXISTS "HiringApplicationQuestionAnswer_questionId_idx" ON "HiringApplicationQuestionAnswer"("questionId");

DO $$ BEGIN
  ALTER TABLE "HiringJobQuestion"
    ADD CONSTRAINT "HiringJobQuestion_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "HiringJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "HiringApplicationQuestionAnswer"
    ADD CONSTRAINT "HiringApplicationQuestionAnswer_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "HiringApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "HiringApplicationQuestionAnswer"
    ADD CONSTRAINT "HiringApplicationQuestionAnswer_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "HiringJobQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
