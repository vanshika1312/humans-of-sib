-- CreateEnum
CREATE TYPE "LiaKnowledgeCategory" AS ENUM ('LEAVE', 'ATTENDANCE', 'PULSE', 'GENERAL', 'BENEFITS', 'CULTURE');

-- CreateEnum
CREATE TYPE "LiaMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "LiaKnowledgeArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "LiaKnowledgeCategory" NOT NULL DEFAULT 'GENERAL',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "detailHref" VARCHAR(2048),
    "detailUrl" VARCHAR(2048),
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiaKnowledgeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiaConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiaConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiaMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "LiaMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "sourcesJson" JSONB,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiaKnowledgeArticle_slug_key" ON "LiaKnowledgeArticle"("slug");

-- CreateIndex
CREATE INDEX "LiaKnowledgeArticle_published_category_sortOrder_idx" ON "LiaKnowledgeArticle"("published", "category", "sortOrder");

-- CreateIndex
CREATE INDEX "LiaConversation_userId_updatedAt_idx" ON "LiaConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "LiaMessage_conversationId_createdAt_idx" ON "LiaMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "LiaKnowledgeArticle" ADD CONSTRAINT "LiaKnowledgeArticle_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaConversation" ADD CONSTRAINT "LiaConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiaMessage" ADD CONSTRAINT "LiaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "LiaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
