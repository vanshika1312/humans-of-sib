import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { HiringJobStatus } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Label, Textarea } from "@/components/ui/input";
import { approveHiringRequisition, rejectHiringRequisition } from "./actions";
import { firstSearchParam } from "@/lib/search-param";
import { formatCalendarDate } from "@/lib/calendar-date";
import { loadPipelineStagesOrdered, funnelActiveFilter } from "@/lib/hiring-pipeline";
import { hiringJobActiveClause, hiringOpenJobsWhere } from "@/lib/hiring-job-active";

export default async function HiringOverviewPage(props: {
  searchParams: Promise<{ reqApproved?: string; reqRejected?: string; reqError?: string }>;
}) {
  const sp = await props.searchParams;
  const reqApproved = firstSearchParam(sp.reqApproved) === "1";
  const reqRejected = firstSearchParam(sp.reqRejected) === "1";
  const reqErrorRaw = firstSearchParam(sp.reqError);

  const [
    openJobsCount,
    candidateCount,
    appGroups,
    closedJobsCount,
    pendingReqs,
    pipelineStagesOrdered,
    openJobs,
    openAppByJobStage,
  ] = await Promise.all([
    prisma.hiringJob.count({ where: { status: "OPEN", ...hiringJobActiveClause } }),
    prisma.hiringCandidate.count(),
    prisma.hiringApplication.groupBy({
      by: ["pipelineStageId"],
      where: { job: hiringJobActiveClause },
      _count: { _all: true },
    }),
    prisma.hiringJob.count({ where: { status: "CLOSED", ...hiringJobActiveClause } }),
    prisma.hiringRequisition.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        department: { select: { name: true, emoji: true } },
        requestedBy: { select: { id: true, name: true, email: true, image: true, title: true } },
      },
    }),
    loadPipelineStagesOrdered(),
    prisma.hiringJob.findMany({
      where: hiringOpenJobsWhere(),
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        department: { select: { name: true, emoji: true } },
      },
    }),
    prisma.hiringApplication.groupBy({
      by: ["jobId", "pipelineStageId"],
      where: { job: hiringOpenJobsWhere() },
      _count: { _all: true },
    }),
  ]);

  const pendingReqCount = pendingReqs.length;
  const byPipelineStageId = new Map<string, number>();
  appGroups.forEach((g) => {
    byPipelineStageId.set(g.pipelineStageId, g._count._all);
  });

  const funnelActiveStages = funnelActiveFilter(pipelineStagesOrdered);
  const inFlight = funnelActiveStages.reduce((n, s) => n + (byPipelineStageId.get(s.id) ?? 0), 0);

  const countsByJobStage = new Map<string, Map<string, number>>();
  for (const row of openAppByJobStage) {
    let inner = countsByJobStage.get(row.jobId);
    if (!inner) {
      inner = new Map<string, number>();
      countsByJobStage.set(row.jobId, inner);
    }
    inner.set(row.pipelineStageId, row._count._all);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        emoji="📋"
        title="Hiring"
        subtitle="Jobs, pipeline, and headcount requests from leaders—approve requisitions here to spin up draft postings."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/hiring/jobs/new">
              <Button variant="accent">New job</Button>
            </Link>
            <Link href="/requisitions">
              <Button variant="outline">Requisitions (submitters) →</Button>
            </Link>
          </div>
        }
      />

      {reqApproved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Requisition approved — a <strong>draft</strong> job was created from the request. Open it from Jobs and set status to Open when you&apos;re ready to source.
        </div>
      )}
      {reqRejected && (
        <div className="rounded-xl border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-800">
          Requisition declined. The requester can see the update on their Job requisition list.
        </div>
      )}
      {reqErrorRaw && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(reqErrorRaw)}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle>Open jobs — pipeline by stage</CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-0 divide-y divide-ink-100">
          {openJobs.length === 0 ? (
            <p className="text-sm text-ink-500 py-8 text-center">
              No open jobs — open a posting from{" "}
              <Link href="/hiring/jobs" className="font-medium text-sky-700 hover:underline">
                Job openings
              </Link>{" "}
              or{" "}
              <Link href="/hiring/jobs/new" className="font-medium text-sky-700 hover:underline">
                create one
              </Link>
              .
            </p>
          ) : (
            openJobs.map((j) => {
              const perJob = countsByJobStage.get(j.id);
              const stageTotal =
                perJob?.size != null ? [...perJob.values()].reduce((a, b) => a + b, 0) : 0;
              return (
                <div key={j.id} className="py-4 first:pt-0 space-y-2">
                  <Link
                    href={`/hiring/jobs/${j.id}`}
                    className="flex flex-wrap items-start justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-ink-700 truncate group-hover:text-sky-800">{j.title}</div>
                      <div className="text-xs text-ink-400 mt-0.5 flex items-center gap-1 flex-wrap">
                        {j.department ? (
                          <>
                            <span>{j.department.emoji}</span>
                            <span>{j.department.name}</span>
                          </>
                        ) : (
                          <span>Any dept</span>
                        )}
                        <span aria-hidden>·</span>
                        <span>{stageTotal} applicant{stageTotal === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    <JobStatusBadge status={j.status} />
                  </Link>
                  <div className="overflow-x-auto pb-0.5 -mx-1 px-1">
                    <div className="flex gap-2 min-w-min">
                      {funnelActiveStages.map((st) => {
                        const n = perJob?.get(st.id) ?? 0;
                        const stageHref = `/hiring/applications?job=${encodeURIComponent(j.id)}&stage=${encodeURIComponent(st.id)}`;
                        return (
                          <Link
                            key={st.id}
                            href={stageHref}
                            className="shrink-0 rounded-lg border border-ink-100 bg-ink-50/40 px-2.5 py-1.5 min-w-[4.5rem] hover:border-ink-200 hover:bg-ink-50/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
                            title={`${st.label} — view applicants`}
                          >
                            <div className="text-[10px] font-medium uppercase tracking-wide text-ink-400 truncate max-w-[6rem]">
                              {st.label}
                            </div>
                            <div className="text-sm font-semibold tabular-nums text-ink-800">{n}</div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Open jobs" value={String(openJobsCount)} tone="sky" />
        <MetricCard title="Active pipeline" value={String(inFlight)} tone="orange" />
        <MetricCard title="Candidates" value={String(candidateCount)} tone="green" />
        <MetricCard title="Pending requisitions" value={String(pendingReqCount)} tone="orange" />
        <MetricCard title="Archived jobs" value={String(closedJobsCount)} tone="ink" />
      </div>

      <Card className="border-orange-100/80 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-ink-100 bg-gradient-to-r from-orange-50/80 to-white">
          <CardTitle>Headcount requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-4 py-3 w-[200px]">Requester</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 min-w-[280px]">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {pendingReqs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-ink-500">
                      No pending requests. Leaders raise them from <strong>Work → Job requisition</strong>.
                    </td>
                  </tr>
                ) : (
                  pendingReqs.map((r) => (
                    <tr key={r.id} className="align-top hover:bg-ink-50/30">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Avatar src={r.requestedBy.image} name={r.requestedBy.name} size="sm" className="shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-medium text-ink-800">{r.requestedBy.name || r.requestedBy.email}</div>
                            <div className="text-[11px] text-ink-400 truncate">{r.requestedBy.email}</div>
                            {r.requestedBy.title && (
                              <div className="text-[11px] text-ink-500 mt-0.5">{r.requestedBy.title}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-700">{r.title}</div>
                        <div className="text-xs text-ink-400 mt-0.5">
                          {r.positions} seat{r.positions === 1 ? "" : "s"}
                          {r.employmentType ? ` · ${r.employmentType}` : ""}
                        </div>
                        {r.justification && (
                          <p className="text-[11px] text-ink-500 mt-2 leading-snug line-clamp-3">{r.justification}</p>
                        )}
                        {r.skillsRequired && (
                          <p className="text-[11px] text-ink-600 mt-2 leading-snug line-clamp-4">
                            <span className="font-semibold text-ink-500">Skills: </span>
                            {r.skillsRequired}
                          </p>
                        )}
                        {r.proposedDeadline && (
                          <div className="text-[11px] text-ink-500 mt-1.5">
                            <span className="font-semibold text-ink-500">Proposed deadline: </span>
                            {formatCalendarDate(r.proposedDeadline)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {r.department ? `${r.department.emoji ?? ""} ${r.department.name}`.trim() : "—"}
                        {r.location && <div className="text-[11px] text-ink-400 mt-1">{r.location}</div>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-500 text-xs">
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(r.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-start">
                          <form action={approveHiringRequisition.bind(null, r.id)}>
                            <Button type="submit" size="sm" variant="accent">
                              Approve
                            </Button>
                          </form>
                          <form action={rejectHiringRequisition.bind(null, r.id)} className="flex-1 space-y-1.5 min-w-[200px]">
                            <Label htmlFor={`reject-${r.id}`} className="text-[11px] text-ink-400">
                              Optional note when declining
                            </Label>
                            <Textarea
                              id={`reject-${r.id}`}
                              name="reviewNote"
                              rows={2}
                              placeholder="Brief reason…"
                              className="text-sm min-h-[56px]"
                            />
                            <Button type="submit" size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50">
                              Decline
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle>Funnel overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-3">
          {pipelineStagesOrdered.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm gap-3">
              <span className="text-ink-600">{s.label}</span>
              <span className="font-semibold tabular-nums text-ink-700">{byPipelineStageId.get(s.id) ?? 0}</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
            <Link
              href="/hiring/pipeline"
              className="inline-flex text-sm font-semibold text-sky-700 hover:underline underline-offset-4"
            >
              Open kanban pipeline →
            </Link>
            <Link
              href="/hiring/pipeline-stages"
              className="inline-flex text-sm font-semibold text-sky-700 hover:underline underline-offset-4"
            >
              Configure stages →
            </Link>
            <Link
              href="/hiring/activity"
              className="inline-flex text-sm font-semibold text-sky-700 hover:underline underline-offset-4"
            >
              Activity history →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone: "sky" | "orange" | "green" | "ink";
}) {
  const ring =
    tone === "sky"
      ? "from-sky-50 to-white ring-sky-100"
      : tone === "orange"
        ? "from-orange-50 to-white ring-orange-100"
        : tone === "green"
          ? "from-emerald-50 to-white ring-emerald-100"
          : "from-ink-50 to-white ring-ink-100";
  return (
    <div className={`rounded-xl border border-ink-100 bg-gradient-to-br ${ring} p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{title}</div>
      <div className="text-2xl font-bold text-ink-800 mt-1 tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-ink-500 mt-1">{hint}</div> : null}
    </div>
  );
}

function JobStatusBadge({ status }: { status: HiringJobStatus }) {
  const tone =
    status === "OPEN" ? "green" : status === "DRAFT" ? "ink" : status === "ON_HOLD" ? "orange" : "sky";
  const label =
    status === "OPEN"
      ? "Open"
      : status === "DRAFT"
        ? "Draft"
        : status === "ON_HOLD"
          ? "On hold"
          : "Closed";
  return <Badge tone={tone}>{label}</Badge>;
}
