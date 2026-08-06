-- Soft-remove closed postings from careers / active lists (restore from Job openings → Removed postings).
-- Idempotent: columns may already exist if previously applied via `db push`.

ALTER TABLE "HiringJob" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "HiringJob" ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'HiringJob_deletedById_fkey'
  ) THEN
    ALTER TABLE "HiringJob"
      ADD CONSTRAINT "HiringJob_deletedById_fkey"
      FOREIGN KEY ("deletedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "HiringJob_deletedAt_idx" ON "HiringJob"("deletedAt");
