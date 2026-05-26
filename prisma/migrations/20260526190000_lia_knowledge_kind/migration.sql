-- CreateEnum
CREATE TYPE "LiaKnowledgeKind" AS ENUM ('DOCUMENT', 'ARTICLE');

-- AlterTable
ALTER TABLE "LiaKnowledgeArticle" ADD COLUMN "kind" "LiaKnowledgeKind" NOT NULL DEFAULT 'ARTICLE';

-- Mark seeded core policies as documents
UPDATE "LiaKnowledgeArticle"
SET "kind" = 'DOCUMENT'
WHERE "slug" IN (
  'leave-policy-overview',
  'sick-leave-medical-proof',
  'attendance-check-in'
);

-- CreateIndex
CREATE INDEX "LiaKnowledgeArticle_kind_published_sortOrder_idx" ON "LiaKnowledgeArticle"("kind", "published", "sortOrder");
