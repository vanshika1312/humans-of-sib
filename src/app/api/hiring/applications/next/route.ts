import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { hiringJobActiveClause } from "@/lib/hiring-job-active";
import { hiringApplicationTextSearchWhere } from "@/lib/hiring-application-search";
import type { Prisma } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const RECRUITER_ROLES = ["CEO", "ADMIN", "HR"] as const;

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

function safeInternalFrom(raw: string | null): string | null {
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

export async function GET(req: Request) {
  const viewer = await requireAppViewer();
  if (!viewer) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!RECRUITER_ROLES.includes(viewer.role as (typeof RECRUITER_ROLES)[number])) {
    return Response.json(
      { ok: false, error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = new URL(req.url);
  const currentId = (url.searchParams.get("currentId") ?? "").trim();
  const fromRaw = url.searchParams.get("from");
  const from = safeInternalFrom(fromRaw);

  if (!currentId) {
    return Response.json(
      { ok: false, error: "Missing currentId" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const current = await prisma.hiringApplication.findUnique({
    where: { id: currentId },
    select: { id: true, appliedAt: true, jobId: true },
  });
  if (!current) {
    return Response.json(
      { ok: false, error: "Application not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  let baseWhere: Prisma.HiringApplicationWhereInput;

  if (from?.startsWith("/hiring/jobs/")) {
    // Job posting detail: stay within this opening only.
    baseWhere = { jobId: current.jobId };
  } else if (from?.startsWith("/hiring/applications")) {
    const { q, job, stage } = parseFromHiringApplications(from);
    const clauses: Prisma.HiringApplicationWhereInput[] = [{ job: hiringJobActiveClause }];
    if (job) clauses.push({ jobId: job });
    if (stage) clauses.push({ pipelineStageId: stage });
    if (q) clauses.push(hiringApplicationTextSearchWhere(q));
    baseWhere = clauses.length ? { AND: clauses } : { job: hiringJobActiveClause };
  } else if (from?.startsWith("/hiring/pipeline")) {
    const { job, stage } = parseFromHiringPipeline(from);
    const clauses: Prisma.HiringApplicationWhereInput[] = [{ job: hiringJobActiveClause }];
    // By-job pipeline view sets job=…; otherwise stay on the current posting.
    clauses.push({ jobId: job || current.jobId });
    if (stage) clauses.push({ pipelineStageId: stage });
    baseWhere = { AND: clauses };
  } else {
    // No list context (direct link, lost ?from=, etc.): do not cross to another posting.
    baseWhere = { jobId: current.jobId };
  }

  const next = await prisma.hiringApplication.findFirst({
    where: { AND: [baseWhere, afterCurrentClause(current)] },
    orderBy: [{ appliedAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  return Response.json(
    { ok: true, nextId: next?.id ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

