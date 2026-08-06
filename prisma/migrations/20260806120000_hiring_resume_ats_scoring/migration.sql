-- Résumé parsing cache on HiringCandidate
ALTER TABLE "HiringCandidate" ADD COLUMN "resumeExtractedText" TEXT;
ALTER TABLE "HiringCandidate" ADD COLUMN "resumeParsedAt" TIMESTAMP(3);

-- ATS score against the job's required skills, stored per application
ALTER TABLE "HiringApplication" ADD COLUMN "resumeMatchScore" INTEGER;
ALTER TABLE "HiringApplication" ADD COLUMN "resumeMatchedSkillsJson" TEXT;
ALTER TABLE "HiringApplication" ADD COLUMN "resumeMissingSkillsJson" TEXT;
ALTER TABLE "HiringApplication" ADD COLUMN "resumeScoredAt" TIMESTAMP(3);
