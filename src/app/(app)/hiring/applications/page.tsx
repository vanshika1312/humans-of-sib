import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApplicationStageControl } from "../_components/application-stage-control";
import { formatDate } from "@/lib/utils";
import {
  applicationSourceLabel,
  formatHiringJobLocation,
  splitCandidateFullName,
} from "@/lib/hiring-application-display";
import { firstSearchParam } from "@/lib/search-param";
import { loadPipelineStagesOrdered } from "@/lib/hiring-pipeline";

type Props = {
  searchParams: Promise<{
    error?: string | string[];
    moved?: string | string[];
    added?: string | string[];
    linked?: string | string[];
    q?: string | string[];
    job?: string | string[];
    stage?: string | string[];
  }>;
};

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

  const qRaw = firstSearchParam(searchParams.q)?.trim() ?? "";
  const jobFilter = firstSearchParam(searchParams.job)?.trim() ?? "";
  const stageFilter = firstSearchParam(searchParams.stage)?.trim() ?? "";
  const filtersActive = !!(qRaw || jobFilter || stageFilter);

  const clauses: Prisma.HiringApplicationWhereInput[] = [];
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

  const [pipelineStagesOrdered, rows, jobsForFilter] = await Promise.all([
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
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 250,
    }),
  ]);

  const stageSelectOptions = pipelineStagesOrdered.map((s) => ({ id: s.id, label: s.label }));

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

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="sticky top-0 z-[1] bg-ink-50/95 backdrop-blur-sm border-b border-ink-100">
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="px-4 py-3 whitespace-nowrap">Date applied</th>
                <th className="px-4 py-3 whitespace-nowrap">First name</th>
                <th className="px-4 py-3 whitespace-nowrap">Last name</th>
                <th className="px-4 py-3 min-w-[180px]">Email</th>
                <th className="px-4 py-3 whitespace-nowrap">Phone</th>
                <th className="px-4 py-3 min-w-[140px]">Role applied for</th>
                <th className="px-4 py-3 min-w-[120px]">Job location</th>
                <th className="px-4 py-3 min-w-[120px]">Candidate location</th>
                <th className="px-4 py-3 min-w-[120px]">Source / job portal</th>
                <th className="px-4 py-3 min-w-[200px]">Stage</th>
                <th className="px-4 py-3 whitespace-nowrap">Application</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6">
                    {filtersActive ? (
                      <div className="rounded-xl border border-dashed border-ink-200 bg-ink-50/40 px-6 py-12 text-center text-sm text-ink-500">
                        No applications match these filters —{" "}
                        <Link href="/hiring/applications" className="font-semibold text-sky-700 hover:underline">
                          clear filters
                        </Link>
                        .
                      </div>
                    ) : (
                      <EmptyState
                        emoji="📥"
                        title="No applications yet"
                        description="Add candidates one at a time or drop a batch of résumés — everything lands against open postings."
                        action={
                          <div className="flex flex-wrap gap-3 justify-center">
                            <Link href="/hiring/candidates/new">
                              <Button variant="accent" size="md">
                                Add candidate
                              </Button>
                            </Link>
                            <Link href="/hiring/applications/import">
                              <Button variant="outline" size="md">
                                Bulk import
                              </Button>
                            </Link>
                          </div>
                        }
                      />
                    )}
                  </td>
                </tr>
              ) : (
                rows.map((app) => {
                  const { firstName, lastName } = splitCandidateFullName(app.candidate.fullName);
                  const portal = applicationSourceLabel(
                    app.applicationSource,
                    app.candidate.source,
                  );
                  const jobLoc = formatHiringJobLocation(app.job);
                  return (
                    <tr key={app.id} className="align-top hover:bg-ink-50/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-ink-600 tabular-nums">
                        {formatDate(app.appliedAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink-800">
                        <Link href={`/hiring/applications/${app.id}`} className="text-sky-800 hover:underline">
                          {firstName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-800">
                        <Link href={`/hiring/applications/${app.id}`} className="hover:underline">
                          {lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-600 break-all">{app.candidate.email}</td>
                      <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{app.candidate.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/hiring/jobs/${app.job.id}`}
                          className="font-medium text-sky-800 hover:underline"
                        >
                          {app.job.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-600">{jobLoc}</td>
                      <td className="px-4 py-3 text-ink-600">{app.candidate.candidateLocation ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-600">{portal}</td>
                      <td className="px-4 py-3">
                        <ApplicationStageControl
                          applicationId={app.id}
                          currentStageId={app.pipelineStageId}
                          stages={stageSelectOptions}
                          returnPath={returnPath}
                          compact
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/hiring/applications/${app.id}`}
                          className="text-xs font-semibold text-sky-700 hover:underline whitespace-nowrap"
                        >
                          Open application →
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
