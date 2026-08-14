-- Core-team notes on the public careers landing (HR-editable).

ALTER TABLE "CareersLandingContent" ADD COLUMN IF NOT EXISTS "voicesTitle" VARCHAR(160) NOT NULL DEFAULT 'Notes from the core team';
ALTER TABLE "CareersLandingContent" ADD COLUMN IF NOT EXISTS "voicesBody" TEXT NOT NULL DEFAULT 'Why we showed up — and why we''d do it again.';

CREATE TABLE IF NOT EXISTS "CareersTeamVoice" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "quote" TEXT NOT NULL DEFAULT '',
    "promptLabel" VARCHAR(80),
    "photoUrl" VARCHAR(2048),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareersTeamVoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CareersTeamVoice_published_sortOrder_idx" ON "CareersTeamVoice"("published", "sortOrder");
