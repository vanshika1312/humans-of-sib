import { prisma } from "@/lib/prisma";
import { hiringJobActiveClause } from "@/lib/hiring-job-active";
import { hiringApplicationTextSearchWhere } from "@/lib/hiring-application-search";
import type { Prisma } from "@/generated/prisma";

export function safeHiringApplicationNavFrom(raw: string | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//")) return null;
  if (!v.startsWith("/hiring/")) return null;
  return v;
}

function parseFromQuery(from: string): URLSearchParams {
  const qIndex = from.indexOf("?");
  return new URLSearchParams(qIndex === -1 ? "" : from.slice(qIndex + 1));
}

function parseFromHiringApplications(from: string): { q: string; job: string; stage: string } {
  const qs = parseFromQuery(from);
  return {
    q: (qs.get("q") ?? "").trim(),
    job: (qs.get("job") ?? "").trim(),
    stage: (qs.get("stage") ?? "").trim(),
  };
}

function parseFromHiringPipeline(from: string): { job: string; stage: string } {
  const qs = parseFromQuery(from);
  return {
    job: (qs.get("job") ?? "").trim(),
    stage: (qs.get("stage") ?? "").trim(),
  };
}

function afterCurrentClause(app: { appliedAt: Date; id: string }): Prisma.HiringApplicationWhereInput {
  return {
    OR: [
      { appliedAt: { lt: app.appliedAt } },
      {
        AND: [{ appliedAt: app.appliedAt }, { id: { lt: app.id } }],
      },
    ],
  };
}

function beforeCurrentClause(app: { appliedAt: Date; id: string }): Prisma.HiringApplicationWhereInput {
  return {
    OR: [
      { appliedAt: { gt: app.appliedAt } },
      {
        AND: [{ appliedAt: app.appliedAt }, { id: { gt: app.id } }],
      },
    ],
  };
}

function listBaseWhere(
  current: { jobId: string },
  from: string | null,
): Prisma.HiringApplicationWhereInput {
  if (from?.startsWith("/hiring/jobs/")) {
    return { jobId: current.jobId };
  }
  if (from?.startsWith("/hiring/applications")) {
    const { q, job, stage } = parseFromHiringApplications(from);
    const clauses: Prisma.HiringApplicationWhereInput[] = [{ job: hiringJobActiveClause }];
    if (job) clauses.push({ jobId: job });
    if (stage) clauses.push({ pipelineStageId: stage });
    if (q) clauses.push(hiringApplicationTextSearchWhere(q));
    return clauses.length ? { AND: clauses } : { job: hiringJobActiveClause };
  }
  if (from?.startsWith("/hiring/pipeline")) {
    const { job, stage } = parseFromHiringPipeline(from);
    const clauses: Prisma.HiringApplicationWhereInput[] = [{ job: hiringJobActiveClause }];
    clauses.push({ jobId: job || current.jobId });
    if (stage) clauses.push({ pipelineStageId: stage });
    return { AND: clauses };
  }
  return { jobId: current.jobId };
}

type NavCurrent = { id: string; appliedAt: Date; jobId: string };

export async function loadHiringApplicationNavCurrent(
  currentId: string,
): Promise<NavCurrent | null> {
  return prisma.hiringApplication.findUnique({
    where: { id: currentId },
    select: { id: true, appliedAt: true, jobId: true },
  });
}

export async function findAdjacentHiringApplicationId(
  current: NavCurrent,
  from: string | null,
  direction: "next" | "prev",
): Promise<string | null> {
  const baseWhere = listBaseWhere(current, from);
  const adjacent = await prisma.hiringApplication.findFirst({
    where: {
      AND: [
        baseWhere,
        direction === "next" ? afterCurrentClause(current) : beforeCurrentClause(current),
      ],
    },
    orderBy:
      direction === "next"
        ? [{ appliedAt: "desc" }, { id: "desc" }]
        : [{ appliedAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  return adjacent?.id ?? null;
}
