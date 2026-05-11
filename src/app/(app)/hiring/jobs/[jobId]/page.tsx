import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { ApplicationStageControl } from "../../_components/application-stage-control";
import { formatDate } from "@/lib/utils";
import { updateJobPosting, createApplication } from "../../actions";
import { firstSearchParam } from "@/lib/search-param";
import { HIRING_JOB_STATUSES, JOB_STATUS_LABEL } from "@/lib/hiring-copy";
import type { HiringJobStatus } from "@/generated/prisma";
import { WORK_ARRANGEMENT_LABEL, WORK_ARRANGEMENT_OPTIONS } from "@/lib/hiring-job-copy";
import { formatCalendarDate, utcCalendarDateToInputValue } from "@/lib/calendar-date";

type Props = {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{
    error?: string | string[];
    saved?: string | string[];
    applied?: string | string[];
  }>;
};

export default async function HiringJobDetailPage(props: Props) {
  const { jobId } = await props.params;
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const saved = firstSearchParam(searchParams.saved) === "1";
  const applied = firstSearchParam(searchParams.applied) === "1";

  const job = await prisma.hiringJob.findUnique({
    where: { id: jobId },
    include: {
      department: true,
      applications: {
        orderBy: { appliedAt: "desc" },
        include: {
          candidate: {
            select: { id: true, fullName: true, email: true, phone: true, source: true },
          },
        },
      },
    },
  });

  if (!job) notFound();

  const [departments, allCandidates] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, emoji: true },
    }),
    prisma.hiringCandidate.findMany({
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  const appliedCandidateIds = new Set(job.applications.map((a) => a.candidateId));
  const bench = allCandidates.filter((c) => !appliedCandidateIds.has(c.id));
  const editAction = updateJobPosting.bind(null, jobId);

  const headerBits = [
    job.workArrangement ? WORK_ARRANGEMENT_LABEL[job.workArrangement] : null,
    job.location,
    job.employmentType,
    job.openings > 0 ? `${job.openings} opening${job.openings === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <PageHeader
        title={job.title}
        subtitle={headerBits.length ? headerBits.join(" · ") : "Job posting"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/hiring/jobs">
              <Button variant="outline" size="md">
                ← Jobs
              </Button>
            </Link>
            <Link href="/hiring/pipeline">
              <Button variant="ghost" size="md">
                Pipeline
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={job.status} />
        {job.department && (
          <Badge tone="sky">
            {job.department.emoji} {job.department.name}
          </Badge>
        )}
      </div>

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Saved — job posting updated.
        </div>
      )}
      {applied && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Candidate added to this opening&apos;s funnel.
        </div>
      )}
      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      <Card className="border-sky-100/80 bg-gradient-to-br from-sky-50/50 to-white">
        <CardHeader className="border-b border-ink-100 pb-4">
          <CardTitle className="text-base">Posting summary</CardTitle>
          <CardDescription>Visible on this job record; edit everything below.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5 grid gap-4 sm:grid-cols-2 text-sm">
          <SummaryRow label="Department" value={job.department ? `${job.department.emoji ?? ""} ${job.department.name}`.trim() : "—"} />
          <SummaryRow
            label="Work arrangement"
            value={job.workArrangement ? WORK_ARRANGEMENT_LABEL[job.workArrangement] : "—"}
          />
          <SummaryRow label="City / region" value={job.location || "—"} />
          <SummaryRow label="Employment type" value={job.employmentType || "—"} />
          <SummaryRow label="Experience required" value={job.experienceRequired || "—"} />
          <SummaryRow label="Salary range" value={job.salaryRange || "—"} />
          <SummaryRow label="Openings" value={String(job.openings)} />
          <SummaryRow
            label="Application deadline"
            value={job.applicationDeadline ? formatCalendarDate(job.applicationDeadline) : "—"}
          />
          <div className="sm:col-span-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Skills required</div>
            <p className="text-ink-700 mt-1 whitespace-pre-wrap">{job.skillsRequired || "—"}</p>
          </div>
        </CardContent>
      </Card>

      {job.description && (
        <div className="rounded-xl border border-ink-100 bg-white p-5 text-sm text-ink-600 leading-relaxed whitespace-pre-wrap">
          {job.description}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle>Edit posting</CardTitle>
          <CardDescription>Role details stay in sync wherever recruiters view them.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form action={editAction} className="space-y-5">
            <div>
              <Label htmlFor="title">Job title</Label>
              <Input id="title" name="title" required defaultValue={job.title} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <Select id="departmentId" name="departmentId" defaultValue={job.departmentId ?? ""} className="mt-1.5">
                <option value="">— Select department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {(d.emoji ? `${d.emoji} ` : "") + d.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Location</div>
              <div>
                <Label htmlFor="workArrangement">Work arrangement</Label>
                <Select
                  id="workArrangement"
                  name="workArrangement"
                  required
                  defaultValue={job.workArrangement ?? "HYBRID"}
                  className="mt-1.5"
                >
                  {WORK_ARRANGEMENT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="location">City / region</Label>
                <Input id="location" name="location" defaultValue={job.location ?? ""} className="mt-1.5" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employmentType">Employment type</Label>
                <Input
                  id="employmentType"
                  name="employmentType"
                  defaultValue={job.employmentType ?? ""}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="openings">Number of openings</Label>
                <Input
                  id="openings"
                  name="openings"
                  type="number"
                  min={1}
                  max={500}
                  defaultValue={job.openings}
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="experienceRequired">Experience required</Label>
                <Input
                  id="experienceRequired"
                  name="experienceRequired"
                  defaultValue={job.experienceRequired ?? ""}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="salaryRange">Salary range</Label>
                <Input id="salaryRange" name="salaryRange" defaultValue={job.salaryRange ?? ""} className="mt-1.5" />
              </div>
            </div>

            <div>
              <Label htmlFor="skillsRequired">Skills required</Label>
              <Textarea
                id="skillsRequired"
                name="skillsRequired"
                rows={4}
                defaultValue={job.skillsRequired ?? ""}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="description">Job description</Label>
              <Textarea id="description" name="description" rows={8} defaultValue={job.description ?? ""} className="mt-1.5" />
            </div>

            <div>
              <Label htmlFor="applicationDeadline">Application deadline</Label>
              <Input
                id="applicationDeadline"
                name="applicationDeadline"
                type="date"
                defaultValue={utcCalendarDateToInputValue(job.applicationDeadline)}
                className="mt-1.5 max-w-[240px]"
              />
            </div>

            <div>
              <Label htmlFor="status">Posting status</Label>
              <Select id="status" name="status" defaultValue={job.status} className="mt-1.5">
                {HIRING_JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {JOB_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="primary">
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle>Add candidate to funnel</CardTitle>
          <CardDescription>Pull from the talent pool. Each person can appear only once per job.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {bench.length === 0 ? (
            <p className="text-sm text-ink-500">
              Everyone in Pool is already on this posting —{" "}
              <Link href="/hiring/candidates" className="font-semibold text-sky-700 hover:underline">
                add profiles
              </Link>{" "}
              first.
            </p>
          ) : (
            <form action={createApplication.bind(null, jobId)} className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-end">
              <div className="flex-1 min-w-[220px]">
                <Label htmlFor="candidateId">Candidate</Label>
                <Select id="candidateId" name="candidateId" required className="mt-1.5 w-full">
                  <option value="">Select…</option>
                  {bench.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} · {c.email}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="accent">
                Attach to opening
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-ink-100">
          <CardTitle>Applicants</CardTitle>
          <CardDescription>Move stages here or from the Pipeline board.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Applied</th>
                  <th className="px-5 py-3 min-w-[220px]">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {job.applications.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-ink-500">
                      No applicants yet — use the card above once candidates exist.
                    </td>
                  </tr>
                ) : (
                  job.applications.map((a) => (
                    <tr key={a.id} className="align-top hover:bg-ink-50/30">
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink-700">{a.candidate.fullName}</div>
                        <div className="text-xs text-ink-400">{a.candidate.email}</div>
                      </td>
                      <td className="px-5 py-3 text-ink-600">{a.candidate.source ?? "—"}</td>
                      <td className="px-5 py-3 whitespace-nowrap text-ink-500">{formatDate(a.appliedAt)}</td>
                      <td className="px-5 py-3">
                        <ApplicationStageControl applicationId={a.id} stage={a.stage} returnPath={`/hiring/jobs/${jobId}`} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      <div className="text-ink-700 mt-0.5">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: HiringJobStatus }) {
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
