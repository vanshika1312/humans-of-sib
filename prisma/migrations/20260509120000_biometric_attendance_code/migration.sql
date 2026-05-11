-- Biometric day classification (P/A/LT/EL/MO/MI mapped at API layer)
CREATE TYPE "BiometricAttendanceCode" AS ENUM (
  'PRESENT',
  'ABSENT',
  'LATE_ARRIVAL',
  'EARLY_LEAVE',
  'MISSED_OUT',
  'MISSED_IN'
);

ALTER TABLE "Attendance" ADD COLUMN "biometricCode" "BiometricAttendanceCode";
