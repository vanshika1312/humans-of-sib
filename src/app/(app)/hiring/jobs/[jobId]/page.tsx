import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { DepartmentNameField } from "@/components/workspace/department-name-field";
import { ApplicationStageControl } from "../../_components/application-stage-control";
import { formatDate } from "@/lib/utils";
import { updateJobPosting, closeJobPosting, deleteClosedJobPosting } from "../../actions";
import { firstSearchParam } from "@/lib/search-param";
import { HIRING_JOB_STATUSES, JOB_STATUS_LABEL } from "@/lib/hiring-copy";
import type { HiringJobStatus } from "@/generated/prisma";
import { WORK_ARRANGEMENT_LABEL, WORK_ARRANGEMENT_OPTIONS } from "@/lib/hiring-job-copy";
import { formatCalendarDate, utcCalendarDateToInputValue } from "@/lib/calendar-date";
import { applicationSourceLabel } from "@/lib/hiring-application-display";
import { loadPipelineStagesOrdered } from "@/lib/hiring-pipeline";

type Props = {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{
    error?: string | string[];
    saved?: string | string[];
    applied?: string | string[];
    closed?: string | string[];
    edit?: string | string[];
  }>;
};

export default async function HiringJobDetailPage(props: Props) {
  const { jobId } = await props.params;
  const searchParams = await props.searchParams;
  const flashError = firstSearchParam(searchParams.error);
  const saved = firstSearchParam(searchParams.saved) === "1";
  const applied = firstSearchParam(searchParams.applied) === "1";
  const flashClosed = firstSearchParam(searchParams.closed) === "1";
  const showEditForm = firstSearchParam(searchParams.edit) === "1";

  const [job, pipelineStagesOrdered] = await Promise.all([
    prisma.hiringJob.findUnique({
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
    }),
    loadPipelineStagesOrdered(),
  ]);

  const stageSelectOptions = pipelineStagesOrdered.map((s) => ({ id: s.id, label: s.label }));

  if (!job) notFound();

  const editAction = updateJobPosting.bind(null, jobId);
  const deleteClosedAction = deleteClosedJobPosting.bind(null, jobId);

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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 w-full min-w-[min(100%,18rem)] sm:w-auto">
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
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button asChild variant="outline" size="md">
                <Link href={`/hiring/jobs/${jobId}?edit=1`}>Edit posting</Link>
              </Button>
              {job.status !== "CLOSED" ? (
                <form action={closeJobPosting.bind(null, jobId)}>
                  <input type="hidden" name="returnTo" value="detail" />
                  <Button type="submit" variant="outline" size="md">
                    Close job
                  </Button>
                </form>
              ) : null}
            </div>
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

      {flashClosed && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Job marked as closed. You can still review applicants below.
        </div>
      )}
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
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Company apply URL</div>
            {job.externalApplyUrl ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a
                  href={job.externalApplyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 transition-colors"
                >
                  Apply on company site
                  <span className="text-sky-200" aria-hidden>
                    ↗
                  </span>
                </a>
                <a
                  href={job.externalApplyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-700 break-all underline hover:text-sky-900 max-w-full"
                >
                  {job.externalApplyUrl}
                </a>
              </div>
            ) : (
              <p className="text-sm text-ink-500 mt-2">
                Not configured — add your HRMS or external application URL when you{" "}
                <Link href={`/hiring/jobs/${jobId}?edit=1`} className="font-semibold text-sky-700 hover:underline">
                  edit posting
                </Link>{" "}
                so job portals can redirect candidates there.
              </p>
            )}
          </div>
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

      {showEditForm ? (
        <Card id="job-edit">
          <CardHeader className="border-b border-ink-100 bg-ink-50/60">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Edit posting</CardTitle>
              </div>
              <Button asChild variant="ghost" size="md">
                <Link href={`/hiring/jobs/${jobId}`}>Cancel</Link>
              </Button>
            </div>
          </CardHeader>
        <CardContent className="pt-6">
          <form action={editAction} className="space-y-5">
            <div>
              <Label htmlFor="title">Job title</Label>
              <Input id="title" name="title" required defaultValue={job.title} className="mt-1.5" />
            </div>
            <DepartmentNameField label="Department" defaultValue={job.department?.name ?? ""} />

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

            <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Apply on company site</div>
              <div>
                <Label htmlFor="externalApplyUrl">Company apply URL (optional)</Label>
                <Input
                  id="externalApplyUrl"
                  name="externalApplyUrl"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  defaultValue={job.externalApplyUrl ?? ""}
                  placeholder="Leave blank if you recruit only inside Humans of SIB"
                  className="mt-1.5"
                />
              </div>
              <p className="text-xs text-ink-500 leading-relaxed">
                Optional — use when job boards send candidates to another URL. Leaving this blank is normal. Draft postings
                still keep everything you enter here after you hit <strong>Save changes</strong>.
              </p>
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
      ) : null}

      <Card>
        <CardHeader className="border-b border-ink-100">
          <CardTitle>Applicants</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-xs font-semibold uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-5 py-3">Source / job portal</th>
                  <th className="px-5 py-3">Applied</th>
                  <th className="px-5 py-3 min-w-[220px]">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {job.applications.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-ink-500 text-sm leading-relaxed">
                      No applicants yet. Add people from{" "}
                      <Link href="/hiring/candidates/new" className="font-semibold text-sky-700 hover:underline">
                        candidate intake
                      </Link>{" "}
                      — they&apos;ll show up here once linked to this opening (e.g. via apply flow or internal tools).
                    </td>
                  </tr>
                ) : (
                  job.applications.map((a) => (
                    <tr key={a.id} className="align-top hover:bg-ink-50/30">
                      <td className="px-5 py-3">
                        <Link href={`/hiring/applications/${a.id}`} className="font-medium text-ink-700 hover:text-sky-800 hover:underline">
                          {a.candidate.fullName}
                        </Link>
                        <div className="text-xs text-ink-400">{a.candidate.email}</div>
                      </td>
                      <td className="px-5 py-3 text-ink-600">
                        {applicationSourceLabel(a.applicationSource, a.candidate.source)}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-ink-500">{formatDate(a.appliedAt)}</td>
                      <td className="px-5 py-3">
                        <ApplicationStageControl
                          applicationId={a.id}
                          currentStageId={a.pipelineStageId}
                          stages={stageSelectOptions}
                          returnPath={`/hiring/jobs/${jobId}`}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {job.status === "CLOSED" ? (
        <Card className="border-red-200 bg-red-50/40">
          <CardHeader className="border-b border-red-100 pb-4">
            <CardTitle className="text-base text-red-900">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <p className="text-sm text-ink-600">
              Permanently delete this closed posting and all of its applications (reviews, attachments, activity).
              Candidate profiles stay in the database if they applied elsewhere too. This cannot be undone.
            </p>
            <form action={deleteClosedAction} className="space-y-3 max-w-lg">
              <div>
                <Label htmlFor="confirmTitle">Type the job title to confirm</Label>
                <Input
                  id="confirmTitle"
                  name="confirmTitle"
                  type="text"
                  autoComplete="off"
                  placeholder={job.title}
                  aria-label="Type job title to confirm deletion"
                  className="mt-1.5"
                />
              </div>
              <Button type="submit" variant="danger" size="sm">
                Delete closed posting permanently
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
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
