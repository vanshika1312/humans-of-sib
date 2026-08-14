-- AlterEnum
ALTER TYPE "HiringActivityKind" ADD VALUE IF NOT EXISTS 'APPLICATION_INTERVIEW_NOTES_SAVED';
ALTER TYPE "HiringInterviewStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "HiringInterviewArtifactStatus" AS ENUM ('NONE', 'PENDING', 'AVAILABLE', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "recordAndTranscribe" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "googleMeetSpaceName" VARCHAR(256);
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "googleMeetJoinUrl" VARCHAR(500);
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "googleMeetConferenceRecordName" VARCHAR(256);
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "recordingStatus" "HiringInterviewArtifactStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "recordingDriveFileId" VARCHAR(256);
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "recordingUrl" VARCHAR(2048);
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "transcriptStatus" "HiringInterviewArtifactStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "transcriptText" TEXT;
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "transcriptDocUrl" VARCHAR(2048);
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "notesSummary" TEXT;
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "notesSummarySource" VARCHAR(16);
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "notesSyncedAt" TIMESTAMP(3);
ALTER TABLE "HiringInterview" ADD COLUMN IF NOT EXISTS "artifactError" TEXT;
