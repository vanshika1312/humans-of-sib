-- Promote pre-round hiring feedback into Screening (merge multiple legacy rows per application).

WITH screening_free_apps AS (
  SELECT DISTINCT r."applicationId"
  FROM "HiringApplicationReview" AS r
  WHERE r."round" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "HiringApplicationReview" AS x
      WHERE x."applicationId" = r."applicationId"
        AND x."round" = 'SCREENING'
    )
),
primary_review AS (
  SELECT DISTINCT ON (r."applicationId")
    r.id,
    r."applicationId"
  FROM "HiringApplicationReview" AS r
  INNER JOIN screening_free_apps AS s ON s."applicationId" = r."applicationId"
  WHERE r."round" IS NULL
  ORDER BY r."applicationId", r."createdAt" DESC
),
merged_comments AS (
  SELECT
    r."applicationId",
    string_agg(r."comment", E'\n\n---\n\n' ORDER BY r."createdAt" ASC) AS merged_comment
  FROM "HiringApplicationReview" AS r
  INNER JOIN screening_free_apps AS s ON s."applicationId" = r."applicationId"
  WHERE r."round" IS NULL
  GROUP BY r."applicationId"
),
latest_rating AS (
  SELECT DISTINCT ON (r."applicationId")
    r."applicationId",
    r."rating",
    r."interviewerUserId",
    r."interviewerName"
  FROM "HiringApplicationReview" AS r
  INNER JOIN screening_free_apps AS s ON s."applicationId" = r."applicationId"
  WHERE r."round" IS NULL
  ORDER BY r."applicationId", r."createdAt" DESC
)
UPDATE "HiringApplicationReview" AS t
SET
  "round" = 'SCREENING',
  "comment" = m.merged_comment,
  "rating" = lr."rating",
  "interviewerUserId" = lr."interviewerUserId",
  "interviewerName" = lr."interviewerName"
FROM primary_review AS p
INNER JOIN merged_comments AS m ON m."applicationId" = p."applicationId"
INNER JOIN latest_rating AS lr ON lr."applicationId" = p."applicationId"
WHERE t.id = p.id;

DELETE FROM "HiringApplicationReview" AS r
WHERE r."round" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "HiringApplicationReview" AS s
    WHERE s."applicationId" = r."applicationId"
      AND s."round" = 'SCREENING'
  );

-- Merge legacy feedback into Screening rows that only have interviewer/rating saved.
WITH merge_targets AS (
  SELECT
    s.id AS screening_id,
    string_agg(l."comment", E'\n\n---\n\n' ORDER BY l."createdAt" ASC) AS merged_comment,
    (array_agg(l."rating" ORDER BY l."createdAt" DESC))[1] AS legacy_rating,
    (array_agg(l."interviewerUserId" ORDER BY l."createdAt" DESC))[1] AS legacy_interviewer_user_id,
    (array_agg(l."interviewerName" ORDER BY l."createdAt" DESC))[1] AS legacy_interviewer_name
  FROM "HiringApplicationReview" AS s
  INNER JOIN "HiringApplicationReview" AS l
    ON l."applicationId" = s."applicationId"
    AND l."round" IS NULL
    AND btrim(l."comment") <> ''
  WHERE s."round" = 'SCREENING'
    AND btrim(s."comment") = ''
  GROUP BY s.id
)
UPDATE "HiringApplicationReview" AS t
SET
  "comment" = m.merged_comment,
  "rating" = COALESCE(t."rating", m.legacy_rating),
  "interviewerUserId" = COALESCE(t."interviewerUserId", m.legacy_interviewer_user_id),
  "interviewerName" = COALESCE(t."interviewerName", m.legacy_interviewer_name)
FROM merge_targets AS m
WHERE t.id = m.screening_id;

DELETE FROM "HiringApplicationReview" AS r
WHERE r."round" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "HiringApplicationReview" AS s
    WHERE s."applicationId" = r."applicationId"
      AND s."round" = 'SCREENING'
      AND btrim(s."comment") <> ''
  );
