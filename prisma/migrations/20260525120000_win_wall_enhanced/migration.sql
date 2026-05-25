-- Win Wall: categories, rewards, reactions, certificates

CREATE TYPE "WinCategory" AS ENUM ('LEARNING', 'OPERATIONS', 'SALES', 'INNOVATION');
CREATE TYPE "WinRewardType" AS ENUM ('NONE', 'CASH', 'CERTIFICATE', 'CASH_AND_CERTIFICATE', 'VOUCHER', 'SHOUTOUT');
CREATE TYPE "WinSource" AS ENUM ('SELF', 'NOMINATION', 'CELEBRATION');
CREATE TYPE "WinReactionKind" AS ENUM ('CLAP', 'FIRE', 'YAY');

ALTER TABLE "Win" ADD COLUMN "celebratedById" TEXT;
ALTER TABLE "Win" ADD COLUMN "category" "WinCategory";
ALTER TABLE "Win" ADD COLUMN "rewardType" "WinRewardType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Win" ADD COLUMN "rewardLabel" TEXT;
ALTER TABLE "Win" ADD COLUMN "rewardAmountPaise" INTEGER;
ALTER TABLE "Win" ADD COLUMN "source" "WinSource" NOT NULL DEFAULT 'SELF';
ALTER TABLE "Win" ADD COLUMN "pointsAwarded" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Win" ADD COLUMN "spotlightMonth" TEXT;

ALTER TABLE "Win" ADD CONSTRAINT "Win_celebratedById_fkey" FOREIGN KEY ("celebratedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Win_spotlightMonth_idx" ON "Win"("spotlightMonth");
CREATE INDEX "Win_source_idx" ON "Win"("source");

CREATE TABLE "WinReaction" (
    "id" TEXT NOT NULL,
    "winId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "WinReactionKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WinReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WinReaction_winId_userId_kind_key" ON "WinReaction"("winId", "userId", "kind");
CREATE INDEX "WinReaction_winId_idx" ON "WinReaction"("winId");

ALTER TABLE "WinReaction" ADD CONSTRAINT "WinReaction_winId_fkey" FOREIGN KEY ("winId") REFERENCES "Win"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WinReaction" ADD CONSTRAINT "WinReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WinReaction" ("id", "winId", "userId", "kind", "createdAt")
SELECT
    'migrated_' || "id",
    "winId",
    "userId",
    'CLAP'::"WinReactionKind",
    "createdAt"
FROM "WinClap";

DROP TABLE "WinClap";

CREATE TABLE "WinCertificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedById" TEXT,
    "winId" TEXT,
    "achievement" TEXT NOT NULL,
    "certNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WinCertificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WinCertificate_winId_key" ON "WinCertificate"("winId");
CREATE UNIQUE INDEX "WinCertificate_certNumber_key" ON "WinCertificate"("certNumber");
CREATE INDEX "WinCertificate_userId_idx" ON "WinCertificate"("userId");
CREATE INDEX "WinCertificate_issuedAt_idx" ON "WinCertificate"("issuedAt");

ALTER TABLE "WinCertificate" ADD CONSTRAINT "WinCertificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WinCertificate" ADD CONSTRAINT "WinCertificate_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WinCertificate" ADD CONSTRAINT "WinCertificate_winId_fkey" FOREIGN KEY ("winId") REFERENCES "Win"("id") ON DELETE SET NULL ON UPDATE CASCADE;
