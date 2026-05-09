-- User directory field (schema already referenced in Prisma)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "residentialAddress" TEXT;
