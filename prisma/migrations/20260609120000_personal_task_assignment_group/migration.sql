-- AlterTable
ALTER TABLE "PersonalTask" ADD COLUMN "assignmentGroupId" TEXT;

-- CreateIndex
CREATE INDEX "PersonalTask_assignmentGroupId_idx" ON "PersonalTask"("assignmentGroupId");
