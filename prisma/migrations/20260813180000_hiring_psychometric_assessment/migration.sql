-- Psychometric pipeline stage + one assessment per application.

ALTER TYPE "HiringActivityKind" ADD VALUE IF NOT EXISTS 'APPLICATION_ASSESSMENT_SUBMITTED';

INSERT INTO "HiringPipelineStage" ("id", "key", "label", "sortOrder", "isHired", "isRejected", "createdAt", "updatedAt")
VALUES (
  'hps_seed_psych001',
  'PSYCHOMETRIC',
  'Psychometric',
  5,
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;

CREATE TABLE IF NOT EXISTS "HiringApplicationAssessment" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "responsesJson" JSONB NOT NULL,
  "dimensionScoresJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HiringApplicationAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HiringApplicationAssessment_applicationId_key"
  ON "HiringApplicationAssessment"("applicationId");

DO $$ BEGIN
  ALTER TABLE "HiringApplicationAssessment"
    ADD CONSTRAINT "HiringApplicationAssessment_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "HiringApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
