-- AlterTable
ALTER TABLE "DeptOkrKeyResult" ADD COLUMN "unitLabel" TEXT;

-- AlterTable
ALTER TABLE "DailyWorkTask" ADD COLUMN "quantityUnit" TEXT NOT NULL DEFAULT 'units';
ALTER TABLE "DailyWorkTask" ADD COLUMN "carriedFromTaskId" TEXT;

-- CreateIndex
CREATE INDEX "DailyWorkTask_carriedFromTaskId_idx" ON "DailyWorkTask"("carriedFromTaskId");

-- AddForeignKey
ALTER TABLE "DailyWorkTask" ADD CONSTRAINT "DailyWorkTask_carriedFromTaskId_fkey" FOREIGN KEY ("carriedFromTaskId") REFERENCES "DailyWorkTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
