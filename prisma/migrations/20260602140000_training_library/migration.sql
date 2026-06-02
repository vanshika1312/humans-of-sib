-- AlterEnum
ALTER TYPE "TrainingType" ADD VALUE 'EXTERNAL_COURSE';

-- AlterEnum
ALTER TYPE "WinSource" ADD VALUE 'TRAINING';

-- AlterTable
ALTER TABLE "Training" ADD COLUMN "author" TEXT,
ADD COLUMN "externalUrl" TEXT,
ADD COLUMN "provider" TEXT,
ADD COLUMN "pointsAwarded" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "Win" ADD COLUMN "trainingId" TEXT;

-- CreateTable
CREATE TABLE "TrainingQuestion" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainingQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TrainingQuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingQuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingQuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingQuestion_trainingId_sortOrder_idx" ON "TrainingQuestion"("trainingId", "sortOrder");

-- CreateIndex
CREATE INDEX "TrainingQuestionOption_questionId_idx" ON "TrainingQuestionOption"("questionId");

-- CreateIndex
CREATE INDEX "TrainingQuizAttempt_userId_trainingId_idx" ON "TrainingQuizAttempt"("userId", "trainingId");

-- CreateIndex
CREATE INDEX "TrainingQuizAttempt_trainingId_idx" ON "TrainingQuizAttempt"("trainingId");

-- CreateIndex
CREATE INDEX "Win_trainingId_idx" ON "Win"("trainingId");

-- CreateIndex
CREATE UNIQUE INDEX "Win_userId_trainingId_key" ON "Win"("userId", "trainingId");

-- AddForeignKey
ALTER TABLE "TrainingQuestion" ADD CONSTRAINT "TrainingQuestion_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingQuestionOption" ADD CONSTRAINT "TrainingQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "TrainingQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingQuizAttempt" ADD CONSTRAINT "TrainingQuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingQuizAttempt" ADD CONSTRAINT "TrainingQuizAttempt_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Win" ADD CONSTRAINT "Win_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE SET NULL ON UPDATE CASCADE;
