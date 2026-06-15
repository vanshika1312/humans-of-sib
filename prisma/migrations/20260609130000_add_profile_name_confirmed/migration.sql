-- AlterTable (EOD app User in eod schema)
ALTER TABLE eod."User" ADD COLUMN IF NOT EXISTS "profileNameConfirmed" BOOLEAN NOT NULL DEFAULT false;
