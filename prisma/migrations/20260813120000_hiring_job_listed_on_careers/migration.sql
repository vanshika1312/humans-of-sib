-- Opt-in public careers listing, independent of OPEN / CLOSED status.

ALTER TABLE "HiringJob" ADD COLUMN IF NOT EXISTS "listedOnCareers" BOOLEAN NOT NULL DEFAULT false;
