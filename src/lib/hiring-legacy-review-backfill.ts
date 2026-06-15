import type { HiringActivityKind } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const LEGACY_COMMENT_SEPARATOR = "\n\n---\n\n";

const REVIEW_ACTIVITY_KINDS: HiringActivityKind[] = [
  "APPLICATION_REVIEW_ADDED",
  "APPLICATION_REVIEW_UPDATED",
];

type LegacyReviewRow = {
  id: string;
  comment: string;
  rating: number | null;
  interviewerUserId: string | null;
  interviewerName: string | null;
  createdAt: Date;
};

type ScreeningReviewRow = {
  id: string;
  comment: string;
  rating: number | null;
  interviewerUserId: string | null;
  interviewerName: string | null;
};

function mergeLegacyComments(reviews: LegacyReviewRow[]): string {
  return reviews
    .map((r) => r.comment.trim())
    .filter(Boolean)
    .join(LEGACY_COMMENT_SEPARATOR);
}

function hasWrittenFeedback(comment: string): boolean {
  return comment.trim().length > 0;
}

function legacyReviewSelect() {
  return {
    id: true,
    comment: true,
    rating: true,
    interviewerUserId: true,
    interviewerName: true,
    createdAt: true,
  } as const;
}

async function loadLegacyReviews(applicationId: string): Promise<LegacyReviewRow[]> {
  return prisma.hiringApplicationReview.findMany({
    where: { applicationId, round: null },
    orderBy: { createdAt: "asc" },
    select: legacyReviewSelect(),
  });
}

/**
 * Recover written feedback from timeline audit events when the review row lost its comment.
 * Returns the longest excerpt found for legacy or Screening feedback.
 */
async function recoverCommentFromTimeline(applicationId: string): Promise<string | null> {
  const events = await prisma.hiringActivity.findMany({
    where: {
      applicationId,
      kind: { in: REVIEW_ACTIVITY_KINDS },
    },
    orderBy: { createdAt: "asc" },
    select: { kind: true, payloadJson: true },
    take: 80,
  });

  let best: string | null = null;

  for (const ev of events) {
    if (!ev.payloadJson) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(ev.payloadJson) as unknown;
    } catch {
      continue;
    }
    if (!payload || typeof payload !== "object") continue;
    const o = payload as Record<string, unknown>;

    const round = typeof o.round === "string" ? o.round : null;
    if (round && round !== "SCREENING") continue;

    const candidates: string[] = [];

    if (ev.kind === "APPLICATION_REVIEW_ADDED") {
      if (typeof o.comment === "string" && o.comment.trim()) {
        candidates.push(o.comment.trim());
      }
    } else {
      for (const key of ["after", "before"] as const) {
        const block = o[key];
        if (!block || typeof block !== "object") continue;
        const comment = (block as Record<string, unknown>).comment;
        if (typeof comment === "string" && comment.trim()) {
          candidates.push(comment.trim());
        }
      }
      if (typeof o.comment === "string" && o.comment.trim()) {
        candidates.push(o.comment.trim());
      }
    }

    for (const text of candidates) {
      if (!best || text.length > best.length) best = text;
    }
  }

  return best;
}

async function promoteLegacyToScreening(
  legacyReviews: LegacyReviewRow[],
): Promise<{ merged: boolean }> {
  const primary = legacyReviews[legacyReviews.length - 1]!;
  const mergedComment = mergeLegacyComments(legacyReviews);
  if (!hasWrittenFeedback(mergedComment)) return { merged: false };

  const duplicateIds = legacyReviews.filter((r) => r.id !== primary.id).map((r) => r.id);

  await prisma.$transaction(async (tx) => {
    await tx.hiringApplicationReview.update({
      where: { id: primary.id },
      data: {
        round: "SCREENING",
        comment: mergedComment,
        rating: primary.rating,
        interviewerUserId: primary.interviewerUserId,
        interviewerName: primary.interviewerName,
      },
    });
    if (duplicateIds.length > 0) {
      await tx.hiringApplicationReview.deleteMany({
        where: { id: { in: duplicateIds } },
      });
    }
  });

  return { merged: true };
}

async function mergeLegacyIntoScreening(
  screening: ScreeningReviewRow,
  legacyReviews: LegacyReviewRow[],
): Promise<{ merged: boolean }> {
  if (hasWrittenFeedback(screening.comment)) return { merged: false };

  const mergedComment = mergeLegacyComments(legacyReviews);
  if (!hasWrittenFeedback(mergedComment)) return { merged: false };

  const primary = legacyReviews[legacyReviews.length - 1]!;

  await prisma.$transaction(async (tx) => {
    await tx.hiringApplicationReview.update({
      where: { id: screening.id },
      data: {
        comment: mergedComment,
        rating: screening.rating ?? primary.rating,
        interviewerUserId: screening.interviewerUserId ?? primary.interviewerUserId,
        interviewerName: screening.interviewerName ?? primary.interviewerName,
      },
    });
    await tx.hiringApplicationReview.deleteMany({
      where: { id: { in: legacyReviews.map((r) => r.id) } },
    });
  });

  return { merged: true };
}

async function recoverScreeningCommentFromTimeline(
  applicationId: string,
  screening: ScreeningReviewRow,
): Promise<{ merged: boolean }> {
  if (hasWrittenFeedback(screening.comment)) return { merged: false };

  const recovered = await recoverCommentFromTimeline(applicationId);
  if (!recovered) return { merged: false };

  await prisma.hiringApplicationReview.update({
    where: { id: screening.id },
    data: { comment: recovered },
  });

  return { merged: true };
}

/**
 * Promote pre-round feedback (`round IS NULL`) into the Screening slot for one application.
 * Also merges legacy rows into an existing Screening row when that row has no written feedback.
 * Idempotent when already migrated.
 */
export async function backfillLegacyHiringReviewsForApplication(
  applicationId: string,
): Promise<{ merged: boolean }> {
  const legacyReviews = await loadLegacyReviews(applicationId);

  const screening = await prisma.hiringApplicationReview.findFirst({
    where: { applicationId, round: "SCREENING" },
    select: {
      id: true,
      comment: true,
      rating: true,
      interviewerUserId: true,
      interviewerName: true,
    },
  });

  if (!screening) {
    if (legacyReviews.length === 0) return { merged: false };
    return promoteLegacyToScreening(legacyReviews);
  }

  if (legacyReviews.length > 0) {
    const merged = await mergeLegacyIntoScreening(screening, legacyReviews);
    if (merged.merged) return merged;
  }

  return recoverScreeningCommentFromTimeline(applicationId, screening);
}

/**
 * Bulk backfill for all applications with legacy feedback or an empty Screening row.
 */
export async function backfillAllLegacyHiringReviews(): Promise<{ applicationsUpdated: number }> {
  const [legacyApps, screeningApps] = await Promise.all([
    prisma.hiringApplicationReview.findMany({
      where: { round: null },
      distinct: ["applicationId"],
      select: { applicationId: true },
    }),
    prisma.hiringApplicationReview.findMany({
      where: { round: "SCREENING", comment: "" },
      distinct: ["applicationId"],
      select: { applicationId: true },
    }),
  ]);

  const applicationIds = [
    ...new Set([
      ...legacyApps.map((r) => r.applicationId),
      ...screeningApps.map((r) => r.applicationId),
    ]),
  ];

  let applicationsUpdated = 0;
  for (const applicationId of applicationIds) {
    const { merged } = await backfillLegacyHiringReviewsForApplication(applicationId);
    if (merged) applicationsUpdated += 1;
  }

  return { applicationsUpdated };
}
