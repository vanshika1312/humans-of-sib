-- AlterTable
ALTER TABLE "DailyWorkTask" ADD COLUMN "assigneeNotes" TEXT;

-- CreateTable
CREATE TABLE "DailyWorkTaskAttachment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileName" VARCHAR(280) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "mimeType" VARCHAR(120),
    "sizeBytes" INTEGER,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyWorkTaskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyWorkTaskAttachment_taskId_idx" ON "DailyWorkTaskAttachment"("taskId");

-- CreateIndex
CREATE INDEX "DailyWorkTaskAttachment_uploadedById_idx" ON "DailyWorkTaskAttachment"("uploadedById");

-- AddForeignKey
ALTER TABLE "DailyWorkTaskAttachment" ADD CONSTRAINT "DailyWorkTaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "DailyWorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyWorkTaskAttachment" ADD CONSTRAINT "DailyWorkTaskAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
