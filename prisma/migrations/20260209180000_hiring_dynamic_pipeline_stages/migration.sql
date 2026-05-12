-- Dynamic hiring funnel: replace HiringApplicationStage enum with HiringPipelineStage rows.

CREATE TABLE "HiringPipelineStage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHired" BOOLEAN NOT NULL DEFAULT false,
    "isRejected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiringPipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HiringPipelineStage_key_key" ON "HiringPipelineStage"("key");

CREATE INDEX "HiringPipelineStage_sortOrder_idx" ON "HiringPipelineStage"("sortOrder");

INSERT INTO "HiringPipelineStage" ("id", "key", "label", "sortOrder", "isHired", "isRejected", "createdAt", "updatedAt")
VALUES
('hps_seed_applied001', 'APPLIED', 'Applied', 0, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('hps_seed_scrn001', 'SCREENING', 'Screening', 10, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('hps_seed_iv001', 'INTERVIEW', 'Interview', 20, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('hps_seed_offer01', 'OFFER', 'Offer', 30, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('hps_seed_hired01', 'HIRED', 'Hired', 40, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('hps_seed_rej001', 'REJECTED', 'Rejected', 50, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

DROP INDEX IF EXISTS "HiringApplication_jobId_stage_idx";

ALTER TABLE "HiringApplication" ADD COLUMN "pipelineStageId" TEXT;

UPDATE "HiringApplication" AS a
SET "pipelineStageId" = s.id
FROM "HiringPipelineStage" AS s
WHERE s.key = CAST(a."stage" AS TEXT);

ALTER TABLE "HiringApplication" ALTER COLUMN "pipelineStageId" SET NOT NULL;

ALTER TABLE "HiringInterviewQuestionTemplate" ADD COLUMN "pipelineStageId" TEXT;

UPDATE "HiringInterviewQuestionTemplate" AS t
SET "pipelineStageId" = s.id
FROM "HiringPipelineStage" AS s
WHERE t."stage" IS NOT NULL AND s.key = CAST(t."stage" AS TEXT);

DROP INDEX IF EXISTS "HiringInterviewQuestionTemplate_category_stage_sortOrder_idx";

ALTER TABLE "HiringInterviewQuestionTemplate" DROP COLUMN "stage";

ALTER TABLE "HiringApplication" DROP COLUMN "stage";

DROP TYPE IF EXISTS "HiringApplicationStage";

ALTER TABLE "HiringApplication"
ADD CONSTRAINT "HiringApplication_pipelineStageId_fkey"
FOREIGN KEY ("pipelineStageId") REFERENCES "HiringPipelineStage"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HiringInterviewQuestionTemplate"
ADD CONSTRAINT "HiringInterviewQuestionTemplate_pipelineStageId_fkey"
FOREIGN KEY ("pipelineStageId") REFERENCES "HiringPipelineStage"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "HiringApplication_jobId_pipelineStageId_idx" ON "HiringApplication"("jobId", "pipelineStageId");

CREATE INDEX "HiringInterviewQuestionTemplate_category_pipelineStageId_sort_order_idx"
ON "HiringInterviewQuestionTemplate"("category", "pipelineStageId", "sortOrder");
