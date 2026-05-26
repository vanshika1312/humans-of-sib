-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('PERSONAL', 'FOR_ALL');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "scope" "DocumentScope" NOT NULL DEFAULT 'PERSONAL';
ALTER TABLE "Document" ADD COLUMN "uploadedById" TEXT;

-- Backfill uploadedById from owner before enforcing NOT NULL
UPDATE "Document" SET "uploadedById" = "userId" WHERE "uploadedById" IS NULL;

ALTER TABLE "Document" ALTER COLUMN "uploadedById" SET NOT NULL;

-- Allow null userId for org-wide documents
ALTER TABLE "Document" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Document_scope_idx" ON "Document"("scope");
CREATE INDEX "Document_uploadedById_idx" ON "Document"("uploadedById");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
