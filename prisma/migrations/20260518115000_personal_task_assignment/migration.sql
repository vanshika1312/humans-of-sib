ALTER TABLE "PersonalTask"
ADD COLUMN "assignedToUserId" TEXT,
ADD COLUMN "assignedByUserId" TEXT;

UPDATE "PersonalTask" AS task
SET
  "assignedToUserId" = board."ownerUserId",
  "assignedByUserId" = board."ownerUserId"
FROM "PersonalTaskBoard" AS board
WHERE board."id" = task."boardId";

ALTER TABLE "PersonalTask"
ALTER COLUMN "assignedToUserId" SET NOT NULL;

ALTER TABLE "PersonalTask"
ADD CONSTRAINT "PersonalTask_assignedToUserId_fkey"
FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "PersonalTask"
ADD CONSTRAINT "PersonalTask_assignedByUserId_fkey"
FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "PersonalTask_assignedToUserId_idx" ON "PersonalTask"("assignedToUserId");
CREATE INDEX "PersonalTask_assignedByUserId_idx" ON "PersonalTask"("assignedByUserId");
