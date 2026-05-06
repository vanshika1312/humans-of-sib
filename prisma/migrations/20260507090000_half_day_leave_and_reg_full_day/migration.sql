-- Regularisation: full-day present correction
ALTER TABLE "RegularisationRequest" ADD COLUMN IF NOT EXISTS "markFullDayPresent" BOOLEAN NOT NULL DEFAULT false;

-- Leave: half-day + fractional ledger totals
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "isHalfDay" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "LeaveBalance" ALTER COLUMN "casualUsed" DROP DEFAULT;
ALTER TABLE "LeaveBalance" ALTER COLUMN "casualUsed" SET DATA TYPE DOUBLE PRECISION USING "casualUsed"::double precision;
ALTER TABLE "LeaveBalance" ALTER COLUMN "casualUsed" SET DEFAULT 0;

ALTER TABLE "LeaveBalance" ALTER COLUMN "sickUsed" DROP DEFAULT;
ALTER TABLE "LeaveBalance" ALTER COLUMN "sickUsed" SET DATA TYPE DOUBLE PRECISION USING "sickUsed"::double precision;
ALTER TABLE "LeaveBalance" ALTER COLUMN "sickUsed" SET DEFAULT 0;

ALTER TABLE "LeaveRequest" ALTER COLUMN "appliedLedgerDebitDays" DROP DEFAULT;
ALTER TABLE "LeaveRequest" ALTER COLUMN "appliedLedgerDebitDays" SET DATA TYPE DOUBLE PRECISION USING "appliedLedgerDebitDays"::double precision;
