-- Candidate careers portal: profile JSON fields, portal auth account, WITHDRAWN stage.

ALTER TABLE "HiringCandidate" ADD COLUMN IF NOT EXISTS "educationJson" JSONB;
ALTER TABLE "HiringCandidate" ADD COLUMN IF NOT EXISTS "workHistoryJson" JSONB;

CREATE TABLE IF NOT EXISTS "HiringCandidatePortalAccount" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(200) NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HiringCandidatePortalAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HiringCandidatePortalAccount_email_key"
  ON "HiringCandidatePortalAccount"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "HiringCandidatePortalAccount_candidateId_key"
  ON "HiringCandidatePortalAccount"("candidateId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HiringCandidatePortalAccount_candidateId_fkey'
  ) THEN
    ALTER TABLE "HiringCandidatePortalAccount"
      ADD CONSTRAINT "HiringCandidatePortalAccount_candidateId_fkey"
      FOREIGN KEY ("candidateId") REFERENCES "HiringCandidate"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Terminal stage for candidate self-withdrawals (excluded from active funnel via isRejected).
INSERT INTO "HiringPipelineStage" ("id", "key", "label", "sortOrder", "isHired", "isRejected", "createdAt", "updatedAt")
VALUES (
  'hps_seed_withdraw01',
  'WITHDRAWN',
  'Withdrawn',
  55,
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
