-- CreateEnum
CREATE TYPE "HiringEmailPurpose" AS ENUM ('OUTREACH', 'SHORTLISTED', 'REJECTED', 'OFFER', 'INTERVIEW_INVITE', 'OTHER');

-- AlterEnum
ALTER TYPE "HiringActivityKind" ADD VALUE 'APPLICATION_EMAIL_SENT';

-- AlterTable
ALTER TABLE "HiringInterviewQuestionTemplate" ADD COLUMN "subject" VARCHAR(500),
ADD COLUMN "emailPurpose" "HiringEmailPurpose",
ADD COLUMN "jobFieldsJson" TEXT;

-- CreateIndex
CREATE INDEX "HiringInterviewQuestionTemplate_category_emailPurpose_idx" ON "HiringInterviewQuestionTemplate"("category", "emailPurpose");

-- CreateTable
CREATE TABLE "HiringApplicationEmail" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "templateId" TEXT,
    "toEmail" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringApplicationEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiringApplicationEmail_applicationId_sentAt_idx" ON "HiringApplicationEmail"("applicationId", "sentAt");

-- AddForeignKey
ALTER TABLE "HiringApplicationEmail" ADD CONSTRAINT "HiringApplicationEmail_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "HiringApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringApplicationEmail" ADD CONSTRAINT "HiringApplicationEmail_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "HiringInterviewQuestionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringApplicationEmail" ADD CONSTRAINT "HiringApplicationEmail_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
