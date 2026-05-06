-- Normalize legacy FIELD mode to OFFICE, then drop FIELD from AttendanceMode.
UPDATE "Attendance" SET "mode" = 'OFFICE' WHERE "mode" = 'FIELD';
UPDATE "RegularisationRequest" SET "requestMode" = 'OFFICE' WHERE "requestMode" = 'FIELD';

CREATE TYPE "AttendanceMode_new" AS ENUM ('OFFICE', 'WFH');

ALTER TABLE "Attendance" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "Attendance" ALTER COLUMN "mode" TYPE "AttendanceMode_new" USING ("mode"::text::"AttendanceMode_new");
ALTER TABLE "RegularisationRequest" ALTER COLUMN "requestMode" TYPE "AttendanceMode_new" USING ("requestMode"::text::"AttendanceMode_new");

ALTER TYPE "AttendanceMode" RENAME TO "AttendanceMode_old";
ALTER TYPE "AttendanceMode_new" RENAME TO "AttendanceMode";
DROP TYPE "AttendanceMode_old";

ALTER TABLE "Attendance" ALTER COLUMN "mode" SET DEFAULT 'OFFICE'::"AttendanceMode";
