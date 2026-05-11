import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HIRING_APPLICATION_STAGES, STAGE_LABEL } from "@/lib/hiring-copy";
import type { HiringApplicationStage, HiringJobStatus } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Label, Textarea } from "@/components/ui/input";
import { approveHiringRequisition, rejectHiringRequisition } from "./actions";
import { firstSearchParam } from "@/lib/search-param";

export default async function HiringOverviewPage(props: {
  searchParams: Promise<{ reqApproved?: string; reqRejected?: string; reqError?: string }>;
}) {
  const sp = await props.searchParams;
  const reqApproved = firstSearchParam(sp.reqApproved) === "1";
  const reqRejected = firstSearchParam(sp.reqRejected) === "1";
  const reqErrorRaw = firstSearchParam(sp.reqError);

  const [openJobsCount, draftsCount, candidateCount, appGroups, closedJobsCount, pendingReqs] = await Promise.all([
    prisma.hiringJob.count({ where: { status: "OPEN" } }),
    prisma.hiringJob.count({ where: { status: "DRAFT" } }),
    prisma.hiringCandidate.count(),
    prisma.hiringApplication.groupBy({
      by: ["stage"],
      _count: { _all: true },
    }),
    prisma.hiringJob.count({ where: { status: "CLOSED" } }),
    prisma.hiringRequisition.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: {
        department: { select: { name: true, emoji: true } },
        requestedBy: { select: { id: true, name: true, email: true, image: true, title: true } },
      },
    }),
  ]);

  const pendingReqCount = pendingReqs.length;
  const byStage = new Map<HiringApplicationStage | string, number>();
  appGroups.forEach((g) => {
    byStage.set(g.stage, g._count._all);
  });

  const inFlight = HIRING_APPLICATION_STAGES.filter((s) => s !== "REJECTED" && s !== "HIRED").reduce(
    (n, s) => n + (byStage.get(s) ?? 0),
    0,
  );

  const recentJobs = await prisma.hiringJob.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      department: { select: { name: true, emoji: true } },
      _count: { select: { applications: true } },
    },
  });

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
            <Link href="/recruitment">
              <Button variant="ghost">Recruitment KPIs →</Button>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Open jobs" value={String(openJobsCount)} hint="Receiving applications" tone="sky" />
        <MetricCard title="Active pipeline" value={String(inFlight)} hint="Excludes hired / rejected" tone="orange" />
        <MetricCard title="Talent pool" value={String(candidateCount)} hint="Unique candidate profiles" tone="green" />
        <MetricCard title="Pending requisitions" value={String(pendingReqCount)} hint="Awaiting your review" tone="orange" />
        <MetricCard title="Archived jobs" value={String(closedJobsCount)} hint={`Drafts saved: ${draftsCount}`} tone="ink" />
      </div>

      <Card className="border-orange-100/80 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-ink-100 bg-gradient-to-r from-orange-50/80 to-white">
          <CardTitle>Headcount requests</CardTitle>
          <CardDescription>
            Submitted by managers and department heads from{" "}
            <strong>Job requisition</strong> in the sidebar. Approve to create a linked draft posting, or decline with an optional note.
          </CardDescription>
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

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b border-ink-100 bg-ink-50/60">
            <CardTitle>Funnel overview</CardTitle>
            <CardDescription>Counts by stage across all postings.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-3">
            {HIRING_APPLICATION_STAGES.map((s) => (
              <div key={s} className="flex items-center justify-between text-sm gap-3">
                <span className="text-ink-600">{STAGE_LABEL[s]}</span>
                <span className="font-semibold tabular-nums text-ink-700">{byStage.get(s) ?? 0}</span>
              </div>
            ))}
            <Link
              href="/hiring/pipeline"
              className="inline-flex text-sm font-semibold text-sky-700 hover:underline mt-2 underline-offset-4"
            >
              Open kanban pipeline →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-ink-100 bg-ink-50/60">
            <CardTitle>Recent postings</CardTitle>
            <CardDescription>Latest updates from your ATS.</CardDescription>
          </CardHeader>
          <CardContent className="pt-5 space-y-0 divide-y divide-ink-100">
            {recentJobs.length === 0 ? (
              <p className="text-sm text-ink-500 py-8 text-center">
                No jobs yet —{" "}
                <Link href="/hiring/jobs/new" className="font-medium text-sky-700 hover:underline">
                  create one
                </Link>
                .
              </p>
            ) : (
              recentJobs.map((j) => (
                <Link
                  key={j.id}
                  href={`/hiring/jobs/${j.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 hover:bg-sky-50/30 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-ink-700 truncate">{j.title}</div>
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
                      <span>{j._count.applications} in pipeline</span>
                    </div>
                  </div>
                  <JobStatusBadge status={j.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
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
  hint: string;
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
      <div className="text-xs text-ink-500 mt-1">{hint}</div>
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
