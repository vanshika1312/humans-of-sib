import type { Prisma } from "@/generated/prisma";

/** Postings still shown on careers, pipeline (active), and job overview lists. */
export const hiringJobActiveClause: Prisma.HiringJobWhereInput = { deletedAt: null };

/** OPEN postings surfaced for intake, careers, and inbound webhooks. */
export function hiringOpenJobsWhere(): Prisma.HiringJobWhereInput {
  return { status: "OPEN", deletedAt: null };
}

/** Single job accepting new applications (internal intake / attach flows). */
export function hiringJobAcceptingApplications(jobId: string): Prisma.HiringJobWhereInput {
  return { id: jobId, status: "OPEN", deletedAt: null };
}
