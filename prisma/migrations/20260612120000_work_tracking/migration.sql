-- Work Tracking: OKRs, daily tasks, EOD, efficiency

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DAILY_TASK_ASSIGNED';
ALTER TYPE "NotificationKind" ADD VALUE 'DAILY_EOD_REMINDER';

-- CreateEnum
CREATE TYPE "TaskComplexity" AS ENUM ('SIMPLE', 'MEDIUM', 'COMPLEX');
CREATE TYPE "DailyTaskPriority" AS ENUM ('P1', 'P2', 'P3');
CREATE TYPE "DailyTaskEodStatus" AS ENUM ('COMPLETED', 'PARTIAL', 'NOT_STARTED');
CREATE TYPE "DailyEodSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'MISSING');
CREATE TYPE "DeptOkrMetricUnit" AS ENUM ('COUNT', 'PERCENT', 'CURRENCY');

-- CreateTable
CREATE TABLE "WorkTrackingConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "eodDeadlineHour" INTEGER NOT NULL DEFAULT 18,
    "eodDeadlineMinute" INTEGER NOT NULL DEFAULT 30,
    "minEodCompliancePct" INTEGER NOT NULL DEFAULT 90,
    "pipEfficiencyThreshold" INTEGER NOT NULL DEFAULT 60,
    "pipConsecutiveWeeks" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTrackingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeptTaskType" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "complexity" "TaskComplexity" NOT NULL DEFAULT 'MEDIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeptTaskType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeptOkrObjective" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "cycle" "OKRCycle" NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER,
    "month" INTEGER,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "OKRStatus" NOT NULL DEFAULT 'ON_TRACK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeptOkrObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeptOkrKeyResult" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taskTypeId" TEXT,
    "targetValue" DECIMAL(12,2) NOT NULL,
    "currentValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit" "DeptOkrMetricUnit" NOT NULL DEFAULT 'COUNT',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeptOkrKeyResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkTask" (
    "id" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "taskTypeId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "targetQuantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "priority" "DailyTaskPriority" NOT NULL DEFAULT 'P2',
    "dueByTime" TEXT,
    "keyResultId" TEXT,
    "eodStatus" "DailyTaskEodStatus",
    "actualQuantity" DECIMAL(12,2),
    "blockerReason" TEXT,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyEodSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "status" "DailyEodSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "efficiencyPct" INTEGER,
    "weightedScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyEodSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyEodTaskEntry" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" "DailyTaskEodStatus" NOT NULL,
    "actualQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "blockerReason" TEXT,
    "carryForward" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DailyEodTaskEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeptTaskType_departmentId_slug_key" ON "DeptTaskType"("departmentId", "slug");
CREATE INDEX "DeptTaskType_departmentId_isActive_idx" ON "DeptTaskType"("departmentId", "isActive");
CREATE INDEX "DeptOkrObjective_departmentId_year_cycle_idx" ON "DeptOkrObjective"("departmentId", "year", "cycle");
CREATE INDEX "DeptOkrKeyResult_objectiveId_idx" ON "DeptOkrKeyResult"("objectiveId");
CREATE INDEX "DeptOkrKeyResult_taskTypeId_idx" ON "DeptOkrKeyResult"("taskTypeId");
CREATE INDEX "DailyWorkTask_assigneeId_workDate_idx" ON "DailyWorkTask"("assigneeId", "workDate");
CREATE INDEX "DailyWorkTask_departmentId_workDate_idx" ON "DailyWorkTask"("departmentId", "workDate");
CREATE INDEX "DailyWorkTask_keyResultId_idx" ON "DailyWorkTask"("keyResultId");
CREATE UNIQUE INDEX "DailyEodSubmission_userId_workDate_key" ON "DailyEodSubmission"("userId", "workDate");
CREATE INDEX "DailyEodSubmission_workDate_idx" ON "DailyEodSubmission"("workDate");
CREATE UNIQUE INDEX "DailyEodTaskEntry_taskId_key" ON "DailyEodTaskEntry"("taskId");
CREATE INDEX "DailyEodTaskEntry_submissionId_idx" ON "DailyEodTaskEntry"("submissionId");

-- AddForeignKey
ALTER TABLE "DeptTaskType" ADD CONSTRAINT "DeptTaskType_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeptOkrObjective" ADD CONSTRAINT "DeptOkrObjective_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeptOkrObjective" ADD CONSTRAINT "DeptOkrObjective_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeptOkrKeyResult" ADD CONSTRAINT "DeptOkrKeyResult_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "DeptOkrObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeptOkrKeyResult" ADD CONSTRAINT "DeptOkrKeyResult_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "DeptTaskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyWorkTask" ADD CONSTRAINT "DailyWorkTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyWorkTask" ADD CONSTRAINT "DailyWorkTask_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyWorkTask" ADD CONSTRAINT "DailyWorkTask_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyWorkTask" ADD CONSTRAINT "DailyWorkTask_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "DeptTaskType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyWorkTask" ADD CONSTRAINT "DailyWorkTask_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "DeptOkrKeyResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyEodSubmission" ADD CONSTRAINT "DailyEodSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyEodTaskEntry" ADD CONSTRAINT "DailyEodTaskEntry_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "DailyEodSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DailyEodTaskEntry" ADD CONSTRAINT "DailyEodTaskEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "DailyWorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default config
INSERT INTO "WorkTrackingConfig" ("id", "eodDeadlineHour", "eodDeadlineMinute", "minEodCompliancePct", "pipEfficiencyThreshold", "pipConsecutiveWeeks", "updatedAt")
VALUES ('singleton', 18, 30, 90, 60, 3, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
