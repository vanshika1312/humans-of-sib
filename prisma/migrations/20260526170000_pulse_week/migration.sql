-- CreateTable
CREATE TABLE "PulseWeek" (
    "weekStart" DATE NOT NULL,
    "question" TEXT NOT NULL,
    "promptLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PulseWeek_pkey" PRIMARY KEY ("weekStart")
);
