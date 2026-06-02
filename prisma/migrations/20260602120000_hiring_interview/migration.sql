-- CreateEnum (idempotent — may exist from a prior db push)
DO $$ BEGIN
    CREATE TYPE "HiringInterviewStatus" AS ENUM ('SCHEDULED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "HiringActivityKind" ADD VALUE IF NOT EXISTS 'APPLICATION_INTERVIEW_SCHEDULED';

-- CreateTable
CREATE TABLE IF NOT EXISTS "HiringInterview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    "title" VARCHAR(280) NOT NULL,
    "notes" TEXT,
    "locationOrLink" VARCHAR(500),
    "status" "HiringInterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "googleCalendarEventId" VARCHAR(256),
    "googleCalendarHtmlLink" VARCHAR(2048),
    "interviewerUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduledById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringInterview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HiringInterview_applicationId_scheduledAt_idx" ON "HiringInterview"("applicationId", "scheduledAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HiringInterview_scheduledAt_idx" ON "HiringInterview"("scheduledAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "HiringInterview" ADD CONSTRAINT "HiringInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "HiringApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "HiringInterview" ADD CONSTRAINT "HiringInterview_scheduledById_fkey" FOREIGN KEY ("scheduledById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
