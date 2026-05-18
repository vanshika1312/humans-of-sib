import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApplicationsTableWithBulk } from "../_components/applications-table-with-bulk";
import { firstSearchParam } from "@/lib/search-param";
import { loadPipelineStagesOrdered } from "@/lib/hiring-pipeline";
import { hiringJobActiveClause } from "@/lib/hiring-job-active";

type Props = {
  searchParams: Promise<{
    error?: string | string[];
    moved?: string | string[];
    added?: string | string[];
    linked?: string | string[];
    applicationDeleted?: string | string[];
    bulkDeleted?: string | string[];
    bulkStageUpdated?: string | string[];
    bulkMoved?: string | string[];
    bulkMoveSkipped?: string | string[];
    q?: string | string[];
    job?: string | string[];
    stage?: string | string[];
  }>;
};

function parseNonNegativeInt(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function applicationsReturnPath(opts: {
  q?: string | null;
  job?: string | null;
  stage?: string | null;
}): `/hiring/applications${string}` {
  const qs = new URLSearchParams();
  if (opts.q?.trim()) qs.set("q", opts.q.trim());
  if (opts.job?.trim()) qs.set("job", opts.job.trim());
  if (opts.stage?.trim()) qs.set("stage", opts.stage.trim());
  const tail = qs.toString();
  return (tail ? `/hiring/applications?${tail}` : `/hiring/applications`) as `/hiring/applications${string}`;
}

export default async function ApplicationsPage(props: Props) {
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const flashMoved = firstSearchParam(searchParams.moved) === "1";
  const flashAdded = firstSearchParam(searchParams.added) === "1";
  const flashLinked = firstSearchParam(searchParams.linked) === "1";
  const flashApplicationDeleted = firstSearchParam(searchParams.applicationDeleted) === "1";
  const bulkDeletedCount = parseNonNegativeInt(firstSearchParam(searchParams.bulkDeleted));
  const bulkStageUpdatedCount = parseNonNegativeInt(firstSearchParam(searchParams.bulkStageUpdated));
  const bulkMovedCount = parseNonNegativeInt(firstSearchParam(searchParams.bulkMoved));
  const bulkMoveSkippedCount = parseNonNegativeInt(firstSearchParam(searchParams.bulkMoveSkipped));

  const qRaw = firstSearchParam(searchParams.q)?.trim() ?? "";
  const jobFilter = firstSearchParam(searchParams.job)?.trim() ?? "";
  const stageFilter = firstSearchParam(searchParams.stage)?.trim() ?? "";
  const filtersActive = !!(qRaw || jobFilter || stageFilter);

  const clauses: Prisma.HiringApplicationWhereInput[] = [{ job: hiringJobActiveClause }];
  if (jobFilter) clauses.push({ jobId: jobFilter });
  if (stageFilter) clauses.push({ pipelineStageId: stageFilter });
  if (qRaw) {
    clauses.push({
      OR: [
        { candidate: { fullName: { contains: qRaw, mode: "insensitive" } } },
        { candidate: { email: { contains: qRaw, mode: "insensitive" } } },
        { job: { title: { contains: qRaw, mode: "insensitive" } } },
      ],
    });
  }
  const where: Prisma.HiringApplicationWhereInput = clauses.length ? { AND: clauses } : {};

  const [pipelineStagesOrdered, rows, jobsForFilter, jobsForBulkMove] = await Promise.all([
    loadPipelineStagesOrdered(),
    prisma.hiringApplication.findMany({
      where,
      orderBy: { appliedAt: "desc" },
      include: {
        candidate: true,
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            workArrangement: true,
          },
        },
        pipelineStage: { select: { id: true, label: true } },
      },
    }),
    prisma.hiringJob.findMany({
      where: hiringJobActiveClause,
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 250,
    }),
    prisma.hiringJob.findMany({
      where: {
        ...hiringJobActiveClause,
        NOT: { status: "DRAFT" },
      },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 400,
    }),
  ]);

  const stageSelectOptions = pipelineStagesOrdered.map((s) => ({ id: s.id, label: s.label }));

  const serializedRows = rows.map((app) => ({
    id: app.id,
    appliedAtIso: app.appliedAt.toISOString(),
    applicationSource: app.applicationSource,
    candidate: {
      fullName: app.candidate.fullName,
      email: app.candidate.email,
      phone: app.candidate.phone,
      candidateLocation: app.candidate.candidateLocation,
      source: app.candidate.source,
    },
    job: app.job,
    pipelineStageId: app.pipelineStageId,
  }));

  const returnPath = applicationsReturnPath({
    q: qRaw || null,
    job: jobFilter || null,
    stage: stageFilter || null,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        emoji="📥"
        subtitle="Every submission linked to an opening — date, contact, role, locations, stage, and how they found us."
        action={
          <div className="flex flex-col gap-2 items-end">
            <Link href="/hiring/applications/import">
              <Button variant="accent" size="md">
                Bulk import
              </Button>
            </Link>
            <Link href="/hiring/pipeline">
              <Button variant="outline" size="md">
                Pipeline board
              </Button>
            </Link>
          </div>
        }
      />

      {flashAdded && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Candidate and application recorded — use the Jobs page or timeline to refine their profile.
        </div>
      )}
      {flashLinked && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Duplicate email — attached the existing candidate to this job&apos;s funnel.
        </div>
      )}
      {flashMoved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Stage updated.
        </div>
      )}
      {flashApplicationDeleted && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Application removed — the candidate profile was not deleted.
        </div>
      )}
      {bulkDeletedCount !== null && bulkDeletedCount > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Removed {bulkDeletedCount} submission{bulkDeletedCount === 1 ? "" : "s"} — candidate profiles were kept.
        </div>
      )}
      {bulkStageUpdatedCount !== null && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {bulkStageUpdatedCount === 0
            ? "No funnel updates needed — every selected row was already on that stage."
            : `Updated funnel stage for ${bulkStageUpdatedCount} submission${bulkStageUpdatedCount === 1 ? "" : "s"}.`}
        </div>
      )}
      {bulkMovedCount !== null && bulkMovedCount > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Moved {bulkMovedCount} submission{bulkMovedCount === 1 ? "" : "s"} to the chosen posting.
          {bulkMoveSkippedCount !== null && bulkMoveSkippedCount > 0 ? (
            <span className="block mt-1 text-emerald-800">
              Skipped {bulkMoveSkippedCount} (already on that posting, duplicate candidate on target, or row no longer
              found).
            </span>
          ) : null}
        </div>
      )}
      {bulkMovedCount !== null && bulkMovedCount === 0 && bulkMoveSkippedCount !== null && bulkMoveSkippedCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          No submissions moved — skipped {bulkMoveSkippedCount} (already on that posting, duplicate on target, or rows
          not found).
        </div>
      )}
      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      <div className="rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-4 py-3 border-b border-ink-100 bg-ink-50/40 flex flex-wrap gap-3 items-end justify-between">
          <form method="GET" className="flex flex-wrap gap-3 flex-1 items-end">
            <div className="min-w-[180px] flex-1 max-w-xs">
              <label htmlFor="app-q" className="sr-only">
                Search
              </label>
              <Input
                id="app-q"
                name="q"
                defaultValue={qRaw}
                placeholder="Search name, email, role…"
                className="h-9"
              />
            </div>
            <div className="min-w-[160px]">
              <label htmlFor="app-job" className="sr-only">
                Job
              </label>
              <select
                id="app-job"
                name="job"
                defaultValue={jobFilter}
                className="w-full h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <option value="">All jobs</option>
                {jobsForFilter.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[160px]">
              <label htmlFor="app-stage" className="sr-only">
                Stage
              </label>
              <select
                id="app-stage"
                name="stage"
                defaultValue={stageFilter}
                className="w-full h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <option value="">All stages</option>
                {pipelineStagesOrdered.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="outline" size="sm" className="h-9 shrink-0">
              Apply filters
            </Button>
            {filtersActive ? (
              <Link href="/hiring/applications">
                <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0">
                  Clear
                </Button>
              </Link>
            ) : null}
          </form>
        </div>

        <ApplicationsTableWithBulk
          rows={serializedRows}
          filtersActive={filtersActive}
          stageSelectOptions={stageSelectOptions}
          jobsForBulkMove={jobsForBulkMove}
          returnPath={returnPath}
        />
      </div>
    </div>
  );
}
