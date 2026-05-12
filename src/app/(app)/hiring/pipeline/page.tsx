import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_LABEL } from "@/lib/hiring-copy";
import { loadPipelineStagesOrdered } from "@/lib/hiring-pipeline";
import { ApplicationStageControl } from "../_components/application-stage-control";
import { formatDate, cn } from "@/lib/utils";
import { firstSearchParam } from "@/lib/search-param";
import type { Prisma } from "@/generated/prisma";

type Props = {
  searchParams: Promise<{
    error?: string | string[];
    moved?: string | string[];
    view?: string | string[];
    stage?: string | string[];
    job?: string | string[];
  }>;
};

const pipelineInclude = {
  candidate: true,
  job: { select: { id: true, title: true, status: true } },
  pipelineStage: { select: { id: true, label: true } },
} satisfies Prisma.HiringApplicationInclude;

type PipelineRow = Prisma.HiringApplicationGetPayload<{ include: typeof pipelineInclude }>;

function applicationsByPipelineColumn(rows: PipelineRow[], orderedStageIds: string[]) {
  const byStage = new Map<string, PipelineRow[]>();
  orderedStageIds.forEach((id) => byStage.set(id, []));
  rows.forEach((r) => {
    const id = r.pipelineStageId;
    if (!byStage.has(id)) byStage.set(id, []);
    byStage.get(id)!.push(r);
  });
  return byStage;
}

function groupApplicationsByJob(rows: PipelineRow[]) {
  const map = new Map<string, { job: PipelineRow["job"]; applications: PipelineRow[] }>();
  rows.forEach((app) => {
    const id = app.job.id;
    let g = map.get(id);
    if (!g) {
      g = { job: app.job, applications: [] };
      map.set(id, g);
    }
    g.applications.push(app);
  });
  return [...map.values()].sort((a, b) =>
    a.job.title.localeCompare(b.job.title, undefined, { sensitivity: "base" }),
  );
}

function PipelineApplicantCard({
  app,
  returnPath,
  showJobOnCard,
  stageSelectOptions,
}: {
  app: PipelineRow;
  returnPath: string;
  showJobOnCard: boolean;
  stageSelectOptions: { id: string; label: string }[];
}) {
  return (
    <article className="rounded-xl bg-white ring-1 ring-ink-100 p-4 space-y-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div>
        <Link
          href={`/hiring/applications/${app.id}`}
          className="font-medium text-sm text-ink-800 leading-snug hover:text-sky-800 hover:underline"
        >
          {app.candidate.fullName}
        </Link>
        <div className="text-[11px] text-ink-400 truncate">{app.candidate.email}</div>
      </div>
      {showJobOnCard ? (
        <Link
          href={`/hiring/jobs/${app.job.id}`}
          className="inline-flex text-[11px] font-semibold text-sky-700 hover:underline truncate max-w-full"
        >
          {app.job.title}
        </Link>
      ) : null}
      <div className="text-[10px] text-ink-400">Applied {formatDate(app.appliedAt)}</div>
      <ApplicationStageControl
        applicationId={app.id}
        currentStageId={app.pipelineStageId}
        stages={stageSelectOptions}
        returnPath={returnPath}
        compact
      />
    </article>
  );
}

function pipelineStageHref(viewMode: "all" | "by-job", jobId: string | undefined, stageId: string) {
  const v = viewMode === "all" ? "all" : "by-job";
  let path = `/hiring/pipeline?view=${v}&stage=${encodeURIComponent(stageId)}`;
  if (viewMode === "by-job" && jobId) {
    path += `&job=${encodeURIComponent(jobId)}`;
  }
  return path;
}

function PipelineStageDashboard({
  rows,
  viewMode,
  focusedJobId,
  selectedStageId,
  showJobOnCard = true,
  columns,
  stageSelectOptions,
}: {
  rows: PipelineRow[];
  viewMode: "all" | "by-job";
  focusedJobId?: string;
  selectedStageId: string | null;
  showJobOnCard?: boolean;
  columns: { id: string; label: string }[];
  stageSelectOptions: { id: string; label: string }[];
}) {
  const orderedIds = columns.map((c) => c.id);
  const byStage = applicationsByPipelineColumn(rows, orderedIds);

  const returnPath = `/hiring/pipeline?view=${viewMode}${focusedJobId ? `&job=${encodeURIComponent(focusedJobId)}` : ""}${selectedStageId ? `&stage=${encodeURIComponent(selectedStageId)}` : ""}`;

  const activeLabel = selectedStageId ? columns.find((c) => c.id === selectedStageId)?.label : null;
  const activeApps = selectedStageId ? (byStage.get(selectedStageId) ?? []) : [];

  return (
    <div className="space-y-5 w-full max-w-6xl">
      <div className="flex gap-3 overflow-x-auto pb-2 pt-0.5 -mx-1 px-1 scroll-ps-1 scroll-pe-1 snap-x snap-mandatory [scrollbar-gutter:stable_both-edges]">
        {columns.map((stage) => {
          const apps = byStage.get(stage.id) ?? [];
          const n = apps.length;
          const isSelected = selectedStageId === stage.id;
          const href = pipelineStageHref(viewMode, focusedJobId, stage.id);
          return (
            <Link
              key={stage.id}
              href={href}
              scroll={false}
              className={cn(
                "shrink-0 snap-start w-[132px] sm:w-[152px] rounded-2xl border p-3.5 sm:p-4 text-left shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2",
                isSelected
                  ? "border-sky-300 bg-gradient-to-br from-sky-50 to-white ring-2 ring-sky-300/80"
                  : "border-ink-100 bg-gradient-to-br from-white to-ink-50/40 hover:border-ink-200 hover:bg-ink-50/60",
              )}
            >
              <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-ink-500 line-clamp-3 leading-snug min-h-[2.25rem]">
                {stage.label}
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <span className="text-2xl font-bold tabular-nums text-ink-800 leading-none">{n}</span>
                <span className="text-[10px] text-ink-400 leading-tight text-right">
                  {n === 1 ? "candidate" : "candidates"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white/80 shadow-sm overflow-hidden">
        {selectedStageId && activeLabel ? (
          <>
            <div className="px-4 py-3 sm:px-5 border-b border-ink-100 bg-ink-50/60 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink-800">{activeLabel}</h3>
              <span className="text-xs text-ink-500 tabular-nums">
                {activeApps.length === 0
                  ? "No one in this stage"
                  : activeApps.length === 1
                    ? "1 applicant"
                    : `${activeApps.length} applicants`}
              </span>
            </div>
            <div className="px-4 py-4 sm:px-5 bg-gradient-to-b from-white to-ink-50/30">
              {activeApps.length === 0 ? (
                <p className="text-sm text-ink-500 text-center py-10">Nobody in this stage yet.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                  {activeApps.map((app) => (
                    <li key={app.id}>
                      <PipelineApplicantCard
                        app={app}
                        returnPath={returnPath}
                        showJobOnCard={showJobOnCard}
                        stageSelectOptions={stageSelectOptions}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="px-4 py-12 sm:px-5 text-center">
            <p className="text-sm text-ink-500">Select a stage card above to see applicants and update their step.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function HiringPipelinePage(props: Props) {
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const flashMoved = firstSearchParam(searchParams.moved) === "1";
  const stageParam = firstSearchParam(searchParams.stage);
  const jobParam = firstSearchParam(searchParams.job);
  const viewParam = firstSearchParam(searchParams.view);
  const viewMode = viewParam === "all" ? "all" : "by-job";

  const [pipelineStagesOrdered, rows] = await Promise.all([
    loadPipelineStagesOrdered(),
    prisma.hiringApplication.findMany({
      orderBy: { appliedAt: "desc" },
      include: pipelineInclude,
    }),
  ]);

  const columns = pipelineStagesOrdered.map((s) => ({ id: s.id, label: s.label }));
  const stageSelectOptions = pipelineStagesOrdered.map((s) => ({ id: s.id, label: s.label }));

  const validStageInUrl =
    stageParam && pipelineStagesOrdered.some((s) => s.id === stageParam) ? stageParam : null;

  const jobGroups = groupApplicationsByJob(rows);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        emoji="🧭"
        subtitle={`Stages show as a horizontal summary — pick one to open the list (${pipelineStagesOrdered.length} configured). Manage labels and order under Hiring → Stages.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/hiring/candidates/new">
              <Button variant="outline" size="md">
                Add candidate →
              </Button>
            </Link>
            <Link href="/hiring/pipeline-stages">
              <Button variant="outline" size="md">
                Edit stages
              </Button>
            </Link>
            <Link href="/hiring/jobs">
              <Button variant="ghost" size="md">
                Jobs
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500 max-w-2xl">
          <strong className="text-ink-700">By job</strong> gives each role its own row of stage cards.{" "}
          <strong className="text-ink-700">All applicants</strong> uses one row for every submission. Click a card to load
          that stage below.
        </p>
        <div className="flex gap-1 p-1 bg-ink-100/70 rounded-xl border border-ink-100 shrink-0">
          <Link
            href="/hiring/pipeline?view=by-job"
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              viewMode === "by-job"
                ? "bg-white text-ink-800 shadow-sm ring-1 ring-ink-100"
                : "text-ink-500 hover:text-ink-700 hover:bg-white/50",
            )}
          >
            By job
          </Link>
          <Link
            href="/hiring/pipeline?view=all"
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              viewMode === "all"
                ? "bg-white text-ink-800 shadow-sm ring-1 ring-ink-100"
                : "text-ink-500 hover:text-ink-700 hover:bg-white/50",
            )}
          >
            All applicants
          </Link>
        </div>
      </div>

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

      {rows.length === 0 ? (
        <p className="text-sm text-ink-500 rounded-xl border border-dashed border-ink-200 bg-ink-50/50 px-4 py-10 text-center">
          No applications in the funnel yet — add a candidate from a job posting or the{" "}
          <Link href="/hiring/candidates/new" className="font-semibold text-sky-700 hover:underline">
            intake form
          </Link>
          .
        </p>
      ) : viewMode === "all" ? (
        <PipelineStageDashboard
          rows={rows}
          viewMode="all"
          selectedStageId={validStageInUrl}
          columns={columns}
          stageSelectOptions={stageSelectOptions}
        />
      ) : (
        <div className="space-y-14">
          {jobGroups.map(({ job, applications }) => (
            <section key={job.id} className="space-y-4 scroll-mt-20">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-ink-100 pb-3">
                <Link href={`/hiring/jobs/${job.id}`} className="text-lg font-bold text-ink-800 hover:text-sky-800">
                  {job.title}
                </Link>
                <Badge tone="ink" className="text-[11px]">
                  {JOB_STATUS_LABEL[job.status]}
                </Badge>
                <span className="text-xs text-ink-400 tabular-nums">{applications.length} applicant(s)</span>
              </div>
              <PipelineStageDashboard
                rows={applications}
                viewMode="by-job"
                focusedJobId={job.id}
                selectedStageId={jobParam === job.id ? validStageInUrl : null}
                showJobOnCard={false}
                columns={columns}
                stageSelectOptions={stageSelectOptions}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
