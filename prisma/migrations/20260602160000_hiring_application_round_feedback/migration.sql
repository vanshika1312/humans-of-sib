-- CreateEnum
CREATE TYPE "HiringInterviewRound" AS ENUM ('SCREENING', 'FIRST_VIRTUAL', 'SECOND_ROUND', 'FINAL_ROUND');

-- AlterTable
ALTER TABLE "HiringApplicationReview" ADD COLUMN "round" "HiringInterviewRound",
ADD COLUMN "interviewerUserId" TEXT,
ADD COLUMN "interviewerName" VARCHAR(200);

-- CreateIndex
CREATE UNIQUE INDEX "HiringApplicationReview_applicationId_round_key" ON "HiringApplicationReview"("applicationId", "round");

-- AddForeignKey
ALTER TABLE "HiringApplicationReview" ADD CONSTRAINT "HiringApplicationReview_interviewerUserId_fkey" FOREIGN KEY ("interviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
