import type { Prisma } from "@/generated/prisma";

/** Postings still shown on pipeline (active) and job overview lists. */
export const hiringJobActiveClause: Prisma.HiringJobWhereInput = { deletedAt: null };

/** OPEN postings surfaced for intake, inbound webhooks, and EOD. */
export function hiringOpenJobsWhere(): Prisma.HiringJobWhereInput {
  return { status: "OPEN", deletedAt: null };
}

/** OPEN postings explicitly listed on the public careers site. */
export function hiringPublicCareersJobsWhere(): Prisma.HiringJobWhereInput {
  return { status: "OPEN", listedOnCareers: true, deletedAt: null };
}

/** OPEN + CLOSED postings still on the active list (overview application bank). */
export function hiringOpenOrClosedJobsWhere(): Prisma.HiringJobWhereInput {
  return { status: { in: ["OPEN", "CLOSED"] }, deletedAt: null };
}

/** Single job accepting new applications (internal intake / attach flows). */
export function hiringJobAcceptingApplications(jobId: string): Prisma.HiringJobWhereInput {
  return { id: jobId, status: "OPEN", deletedAt: null };
}

/** Single job visible on careers and accepting candidate self-apply. */
export function hiringJobAcceptingPublicApplications(jobId: string): Prisma.HiringJobWhereInput {
  return { id: jobId, status: "OPEN", listedOnCareers: true, deletedAt: null };
}
