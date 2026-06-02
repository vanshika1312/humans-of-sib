import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import {
  applicationSourceLabel,
  formatHiringJobLocation,
  jobSkillKeywords,
} from "@/lib/hiring-application-display";
import { WORK_ARRANGEMENT_LABEL } from "@/lib/hiring-job-copy";
import { loadPipelineStagesOrdered } from "@/lib/hiring-pipeline";
import { HiringActivityPayloadBlock } from "@/components/hiring/hiring-activity-payload";
import { HIRING_ACTIVITY_KIND_LABEL } from "@/lib/hiring-activity-kind-copy";
import {
  addHiringApplicationAttachment,
  createHiringApplicationReview,
  deleteHiringApplicationAttachment,
  moveHiringApplicationToJob,
  updateHiringApplicationReview,
} from "../../actions";
import { DeleteApplicationForm } from "../../_components/delete-application-form";
import { ApplicationStageControl } from "../../_components/application-stage-control";
import { HiringApplicationSectionNav } from "./application-section-nav";
import { CopyTextButton } from "@/components/ui/copy-text-button";
import { hiringJobActiveClause } from "@/lib/hiring-job-active";
import { firstSearchParam } from "@/lib/search-param";
import { cn } from "@/lib/utils";
import { DeleteReviewForm } from "../../_components/delete-review-form";
import { HiringApplicationEmailComposer } from "@/components/hiring/hiring-application-email-composer";
import { HiringInterviewScheduleTrigger } from "@/components/hiring/hiring-interview-scheduler";
import { isBulkImportStoredResumeUrl } from "@/lib/hiring-resume-upload";
import type { HiringTemplateMergeContext } from "@/lib/hiring-template-merge";
import { googleCalendarConfigured } from "@/lib/google-calendar";
import { displayName } from "@/lib/user-display-name";

type Props = {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{
    tab?: string | string[];
    from?: string | string[];
    error?: string | string[];
    attached?: string | string[];
    attachmentRemoved?: string | string[];
    moved?: string | string[];
    reviewSaved?: string | string[];
    reviewUpdated?: string | string[];
    reviewDeleted?: string | string[];
    jobMoved?: string | string[];
    emailSent?: string | string[];
    emailError?: string | string[];
    interviewScheduled?: string | string[];
    interviewError?: string | string[];
  }>;
};

const HR_GATE = ["CEO", "ADMIN", "HR"];

export default async function HiringApplicationDetailPage(props: Props) {
  const { applicationId } = await props.params;
  const sp = await props.searchParams;

  const tab = firstSearchParam(sp.tab);
  const from = firstSearchParam(sp.from);
  const isTimeline = tab === "timeline";
  const flashError = firstSearchParam(sp.error);
  const attached = firstSearchParam(sp.attached) === "1";
  const attachmentRemoved = firstSearchParam(sp.attachmentRemoved) === "1";
  const moved = firstSearchParam(sp.moved) === "1";
  const reviewSaved = firstSearchParam(sp.reviewSaved) === "1";
  const reviewUpdated = firstSearchParam(sp.reviewUpdated) === "1";
  const reviewDeleted = firstSearchParam(sp.reviewDeleted) === "1";
  const jobMoved = firstSearchParam(sp.jobMoved) === "1";
  const emailSent = firstSearchParam(sp.emailSent) === "1";
  const emailError = firstSearchParam(sp.emailError);
  const interviewScheduled = firstSearchParam(sp.interviewScheduled) === "1";
  const interviewError = firstSearchParam(sp.interviewError);

  const session = await auth();
  const viewer = session?.user?.email
    ? await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true, name: true, firstName: true, lastName: true, email: true },
      })
    : null;
  const canSendHiringEmail = Boolean(viewer && HR_GATE.includes(viewer.role));
  const canScheduleInterview = canSendHiringEmail;
  const calendarConfigured = googleCalendarConfigured();

  const app = await prisma.hiringApplication.findUnique({
    where: { id: applicationId },
    include: {
      candidate: {
        include: {
          createdBy: { select: { name: true, email: true } },
        },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
        include: { addedBy: { select: { name: true, email: true } } },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { author: { select: { name: true, email: true } } },
      },
      job: { include: { department: true } },
      pipelineStage: { select: { id: true, key: true, label: true, isRejected: true, isHired: true } },
    },
  });

  if (!app) notFound();

  const [
    pipelineStagesOrdered,
    interviewTemplates,
    allQuestionnaireTemplates,
    emailTemplates,
    sentEmails,
    moveTargetJobs,
    scheduledInterviews,
    interviewerOptions,
  ] = await Promise.all([
    loadPipelineStagesOrdered(),
    prisma.hiringInterviewQuestionTemplate.findMany({
      where: { category: "QUESTIONNAIRE_GUIDE", pipelineStageId: app.pipelineStageId },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.hiringInterviewQuestionTemplate.findMany({
      where: { category: "QUESTIONNAIRE_GUIDE" },
      orderBy: [{ pipelineStageId: "asc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
      include: { pipelineStage: { select: { id: true, label: true } } },
    }),
    prisma.hiringInterviewQuestionTemplate.findMany({
      where: { category: "EMAIL" },
      orderBy: [{ emailPurpose: "asc" }, { title: "asc" }],
      select: { id: true, title: true, subject: true, body: true, emailPurpose: true },
    }),
    prisma.hiringApplicationEmail.findMany({
      where: { applicationId },
      orderBy: { sentAt: "desc" },
      take: 30,
      include: { sentBy: { select: { name: true, email: true } } },
    }),
    prisma.hiringJob.findMany({
      where: {
        ...hiringJobActiveClause,
        NOT: { status: "DRAFT" },
        id: { not: app.jobId },
      },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
      take: 400,
    }),
    prisma.hiringInterview.findMany({
      where: { applicationId, status: "SCHEDULED" },
      orderBy: { scheduledAt: "asc" },
      include: { scheduledBy: { select: { name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { invitationPending: false },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, firstName: true, lastName: true, email: true },
      take: 300,
    }),
  ]);

  const stageSelectOptions = pipelineStagesOrdered.map((s) => ({ id: s.id, label: s.label }));
  const sourceLabel = applicationSourceLabel(app.applicationSource, app.candidate.source);
  const jobLoc = formatHiringJobLocation(app.job);
  const skills = jobSkillKeywords(app.job.skillsRequired);
  const recruiter = app.candidate.createdBy?.name ?? app.candidate.createdBy?.email ?? "—";
  const recruiterName =
    viewer?.name ||
    [viewer?.firstName, viewer?.lastName].filter(Boolean).join(" ") ||
    viewer?.email ||
    "Recruiting team";

  const emailMergeContext: HiringTemplateMergeContext = {
    candidateName: app.candidate.fullName,
    candidateEmail: app.candidate.email,
    jobTitle: app.job.title,
    stageLabel: app.pipelineStage.label,
    recruiterName,
  };

  const emailTemplateOptions = emailTemplates
    .filter((t) => t.subject && t.emailPurpose)
    .map((t) => ({
      id: t.id,
      title: t.title,
      subject: t.subject!,
      body: t.body,
      emailPurpose: t.emailPurpose!,
    }));

  const questionnairesByOtherStage = pipelineStagesOrdered
    .filter((s) => s.id !== app.pipelineStageId)
    .map((stage) => ({
      stage,
      templates: allQuestionnaireTemplates.filter((t) => t.pipelineStageId === stage.id),
    }))
    .filter((g) => g.templates.length > 0);
  const jobDept = app.job.department
    ? `${app.job.department.emoji ?? ""} ${app.job.department.name}`.trim()
    : "—";

  const addAttachmentAction = addHiringApplicationAttachment.bind(null, applicationId);

  const timelineEvents = isTimeline
    ? await prisma.hiringActivity.findMany({
        where: { candidateId: app.candidateId, applicationId },
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true, email: true } } },
        take: 80,
      })
    : [];

  const qsFrom = from ? `&from=${encodeURIComponent(from)}` : "";
  const overviewHref = from
    ? (`/hiring/applications/${applicationId}?from=${encodeURIComponent(from)}` as const)
    : (`/hiring/applications/${applicationId}` as const);
  const timelineHref = (`/hiring/applications/${applicationId}?tab=timeline${qsFrom}` as const);
  const detailReturnPath = overviewHref;
  const profileResumeHref = app.candidate.resumeUrl?.trim();

  const reviewAction = createHiringApplicationReview.bind(null, applicationId);
  const updateReviewAction = updateHiringApplicationReview;
  const moveJobAction = moveHiringApplicationToJob.bind(null, applicationId);

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start pb-14">
      <aside className="w-full lg:w-[220px] shrink-0 space-y-4 lg:sticky lg:top-20">
        <HiringApplicationSectionNav />
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <header className="flex flex-col gap-4 border-b border-ink-100 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Application</p>
              <h1 className="text-2xl md:text-3xl font-bold text-ink-800 mt-1">{app.candidate.fullName}</h1>
              <p className="text-sm text-ink-500 mt-0.5">{app.job.title}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="green">{app.pipelineStage.label}</Badge>
              <Badge tone="ink">Applications</Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex gap-1 p-1 bg-ink-100/70 rounded-xl w-fit border border-ink-100 shrink-0">
              <Link
                href={overviewHref}
                scroll={false}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  !isTimeline
                    ? "bg-white text-ink-800 shadow-sm ring-1 ring-ink-100"
                    : "text-ink-500 hover:text-ink-700 hover:bg-white/50",
                )}
              >
                Overview
              </Link>
              <Link
                href={timelineHref}
                scroll={false}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  isTimeline
                    ? "bg-white text-ink-800 shadow-sm ring-1 ring-ink-100"
                    : "text-ink-500 hover:text-ink-700 hover:bg-white/50",
                )}
              >
                Timeline
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 text-sm items-center ml-auto">
              <HiringInterviewScheduleTrigger
                applicationId={applicationId}
                candidateName={app.candidate.fullName}
                jobTitle={app.job.title}
                canSchedule={canScheduleInterview}
                calendarConfigured={calendarConfigured}
                scheduledInterviews={scheduledInterviews}
                candidateResumeUrl={profileResumeHref ?? null}
                applicationAttachments={app.attachments.map((a) => ({
                  id: a.id,
                  fileName: a.fileName,
                  category: a.category,
                  canAttachToCalendar: isBulkImportStoredResumeUrl(a.url),
                }))}
                interviewers={interviewerOptions.map((u) => ({
                  id: u.id,
                  name: displayName(u),
                  email: u.email,
                }))}
              />
              <a href={`mailto:${encodeURIComponent(app.candidate.email)}`}>
                <Button type="button" variant="outline" size="sm">
                  Email
                </Button>
              </a>
              <ApplicationStageControl
                applicationId={applicationId}
                currentStageId={app.pipelineStageId}
                stages={stageSelectOptions}
                returnPath={detailReturnPath}
              />
              <Link href="/hiring/applications">
                <Button type="button" variant="ghost" size="sm">
                  ← Applications
                </Button>
              </Link>
            </div>
          </div>
          <p className="text-xs text-ink-400">Last updated {formatDate(app.updatedAt)} · Application ID · {applicationId}</p>
        </header>

        {attached && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Attachment added.
          </div>
        )}
        {attachmentRemoved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Attachment removed.
          </div>
        )}
        {moved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Pipeline stage updated.
          </div>
        )}
        {jobMoved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Submission moved to another posting — funnel reset to the applied stage for that opening.
          </div>
        )}
        {reviewSaved && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Feedback saved on this submission.
          </div>
        )}
        {reviewUpdated && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Feedback updated — timeline entry added.
          </div>
        )}
        {reviewDeleted && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Feedback deleted — timeline entry added.
          </div>
        )}
        {interviewScheduled && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Interview scheduled — calendar invites sent to the candidate and interviewers.
          </div>
        )}
        {interviewError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {decodeURIComponent(interviewError)}
          </div>
        )}
        {flashError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {decodeURIComponent(flashError)}
          </div>
        )}

        {isTimeline ? (
          <section className="scroll-mt-24 space-y-4">
            <Card>
              <CardHeader className="border-b border-ink-100">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle>Submission timeline</CardTitle>
                  <Link href={`/hiring/timeline/${app.candidateId}`} className="text-sm font-semibold text-sky-700 hover:underline shrink-0">
                    Candidate timeline →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {timelineEvents.length === 0 ? (
                  <p className="text-sm text-ink-500">
                    Nothing logged on this submission yet — stage moves and attachments will appear here.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {timelineEvents.map((ev) => (
                      <li key={ev.id} className="border border-ink-100 rounded-xl p-4 bg-white">
                        <div className="flex flex-wrap items-baseline gap-2 gap-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                            {HIRING_ACTIVITY_KIND_LABEL[ev.kind]}
                          </span>
                          <span className="text-xs text-ink-400">{formatDate(ev.createdAt)}</span>
                        </div>
                        <p className="text-sm text-ink-700 mt-1.5">{ev.summary}</p>
                        {(ev.actor?.name || ev.actor?.email) && (
                          <p className="text-[11px] text-ink-400 mt-1">
                            By {ev.actor?.name ?? ev.actor?.email}
                          </p>
                        )}
                        {ev.payloadJson ? (
                          <HiringActivityPayloadBlock
                            kind={ev.kind}
                            payloadJson={ev.payloadJson}
                            timelineSurface
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        ) : (
          <>
            <section id="section-summary" className="scroll-mt-24">
              <Card className="border-sky-100/70 bg-gradient-to-br from-sky-50/40 to-white">
                <CardHeader className="border-b border-ink-100 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">Candidate summary</CardTitle>
                      <CardDescription>{app.job.title}</CardDescription>
                    </div>
                    <Link href={`/hiring/timeline/${app.candidateId}`} className="text-sm font-semibold text-sky-700 hover:underline">
                      View candidate record →
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-5 grid gap-4 sm:grid-cols-2 text-sm">
                  <SummaryItem label="Email" value={app.candidate.email} />
                  <SummaryItem label="Mobile / phone" value={app.candidate.phone ?? "—"} />
                  <SummaryItem label="Candidate location" value={app.candidate.candidateLocation ?? "—"} />
                  <SummaryItem label="Application source" value={sourceLabel} />
                  <SummaryItem label="Job opening" value={<Link href={`/hiring/jobs/${app.jobId}`} className="font-medium text-sky-700 hover:underline">{app.job.title}</Link>} />
                  <SummaryItem label="Posting location" value={jobLoc} />
                  <SummaryItem label="Department" value={jobDept} />
                  <SummaryItem label="Assigned recruiter" value={recruiter} />
                  <div className="sm:col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Skills from posting</div>
                    {skills.length === 0 ? (
                      <p className="text-ink-500 mt-1">—</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {skills.map((s) => (
                          <span
                            key={s}
                            className="inline-flex rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink-600 ring-1 ring-ink-200"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="section-details" className="scroll-mt-24">
              <Card>
                <CardHeader className="border-b border-ink-100 bg-ink-50/60">
                  <CardTitle>Application details</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 grid gap-6 sm:grid-cols-2 text-sm">
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Basic info</h3>
                    <div className="space-y-3">
                      <DetailRow label="Application ID" value={applicationId} />
                      <DetailRow label="Posting title" value={app.job.title} />
                      <DetailRow label="Department" value={jobDept} />
                      <DetailRow label="Work arrangement" value={app.job.workArrangement ? WORK_ARRANGEMENT_LABEL[app.job.workArrangement] : "—"} />
                      <DetailRow label="Posting location" value={jobLoc} />
                      <DetailRow label="Email" value={app.candidate.email} />
                      <DetailRow label="Phone" value={app.candidate.phone ?? "—"} />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Other info</h3>
                    <div className="space-y-3">
                      <DetailRow label="Application source" value={sourceLabel} />
                      <DetailRow label="Applied on" value={formatDate(app.appliedAt)} />
                      <DetailRow label="Application owner" value={recruiter} />
                      <DetailRow
                        label="Application stage"
                        value={
                          <>
                            Applications · funnel: <strong>{app.pipelineStage.label}</strong>
                          </>
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="section-move-delete" className="scroll-mt-24">
              <Card className="border-ink-200">
                <CardHeader className="border-b border-ink-100 bg-ink-50/60">
                  <CardTitle>Move or remove submission</CardTitle>
                  <CardDescription>
                    Change which opening this candidate is tied to, or delete this submission only (candidate profile
                    stays).
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-3 max-w-xl">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Move to another posting</h3>
                    {moveTargetJobs.length === 0 ? (
                      <p className="text-sm text-ink-500">
                        No other active postings available — create a job or restore a removed posting first.
                      </p>
                    ) : (
                      <form action={moveJobAction} className="flex flex-col sm:flex-row flex-wrap gap-3 sm:items-end">
                        <input type="hidden" name="returnPath" value={detailReturnPath} />
                        <div className="flex-1 min-w-[200px]">
                          <Label htmlFor="targetJobId">Target opening</Label>
                          <Select id="targetJobId" name="targetJobId" required defaultValue="" className="mt-1.5">
                            <option value="" disabled>
                              Choose posting…
                            </option>
                            {moveTargetJobs.map((j) => (
                              <option key={j.id} value={j.id}>
                                {j.title}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button type="submit" variant="outline">
                          Move submission
                        </Button>
                      </form>
                    )}
                    <p className="text-xs text-ink-400 leading-relaxed">
                      Draft jobs and removed-from-list postings are excluded. If the candidate already applied to the
                      target opening, open that application instead.
                    </p>
                  </div>
                  <div className="border-t border-ink-100 pt-5 space-y-3">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Danger zone</h3>
                    <p className="text-sm text-ink-600 max-w-xl">
                      Deletes this application row only — attachments and feedback here are removed. Pipeline history on
                      this submission is removed; the person&apos;s candidate record remains.
                    </p>
                    <DeleteApplicationForm applicationId={applicationId} />
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="section-attachments" className="scroll-mt-24">
              <Card>
                <CardHeader className="border-b border-ink-100 bg-ink-50/60">
                  <CardTitle>Attachments</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="overflow-x-auto rounded-xl border border-ink-100">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead>
                        <tr className="border-b border-ink-100 bg-ink-50/50 text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                          <th className="px-4 py-3">File / link</th>
                          <th className="px-4 py-3 whitespace-nowrap">Category</th>
                          <th className="px-4 py-3 whitespace-nowrap">Attached by</th>
                          <th className="px-4 py-3 whitespace-nowrap">Added</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {profileResumeHref ? (
                          <tr className="bg-sky-50/30">
                            <td className="px-4 py-3">
                              <span className="font-medium text-ink-800">Candidate profile résumé</span>
                              <div className="text-xs text-ink-400 mt-0.5 break-all">{profileResumeHref}</div>
                            </td>
                            <td className="px-4 py-3 text-ink-600 whitespace-nowrap">Résumé (profile)</td>
                            <td className="px-4 py-3 text-ink-500 text-xs">—</td>
                            <td className="px-4 py-3 text-ink-500 text-xs">—</td>
                            <td className="px-4 py-3 text-right">
                              <a
                                href={profileResumeHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-sky-700 hover:underline"
                              >
                                Open →
                              </a>
                            </td>
                          </tr>
                        ) : null}
                        {app.attachments.map((a) => {
                          const attachedByLabel = a.addedBy?.name ?? a.addedBy?.email ?? "—";
                          const href =
                            a.url.startsWith("/") || a.url.startsWith("http://") || a.url.startsWith("https://")
                              ? a.url
                              : `https://${a.url}`;
                          return (
                            <tr key={a.id} className="align-top">
                              <td className="px-4 py-3 font-medium text-ink-800">{a.fileName}</td>
                              <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{a.category}</td>
                              <td className="px-4 py-3 text-ink-600 text-xs whitespace-nowrap">{attachedByLabel}</td>
                              <td className="px-4 py-3 text-ink-500 text-xs whitespace-nowrap tabular-nums">
                                {formatDate(a.createdAt)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <a href={href} target="_blank" rel="noopener noreferrer">
                                    <Button type="button" variant="ghost" size="sm">
                                      Open
                                    </Button>
                                  </a>
                                  <form action={deleteHiringApplicationAttachment.bind(null, a.id)} className="inline">
                                    <input type="hidden" name="redirectTo" value={detailReturnPath} />
                                    <Button type="submit" variant="danger" size="sm">
                                      Remove
                                    </Button>
                                  </form>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {!profileResumeHref && app.attachments.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-10 text-center text-ink-500 text-sm">
                              No attachments on this submission yet — add a link or upload below.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-xl border border-ink-200 bg-white p-4 space-y-4 max-w-xl">
                    <form action={addAttachmentAction} className="grid gap-4">
                      <input type="hidden" name="returnPath" value={detailReturnPath} />
                      <fieldset className="space-y-2 border-0 p-0 m-0 min-w-0">
                        <legend className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                          Attach a link or file
                        </legend>
                        <p className="text-[11px] text-ink-400 leading-snug">
                          Paste a share link (Google Drive, Dropbox, any https URL) <span className="text-ink-500">or</span> choose a
                          PDF / Word document from your computer — one attachment per submission.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                          <div className="flex-1 min-w-0">
                            <Label htmlFor="driveOrLinkUrl" className="sr-only">
                              Link URL
                            </Label>
                            <Input
                              id="driveOrLinkUrl"
                              name="driveOrLinkUrl"
                              placeholder="https://drive.google.com/…"
                              className="mt-0"
                              autoComplete="off"
                            />
                          </div>
                          <div className="flex-1 sm:max-w-[min(100%,16rem)] min-w-0">
                            <Label htmlFor="attachmentFile" className="sr-only">
                              File upload
                            </Label>
                            <Input
                              id="attachmentFile"
                              name="attachmentFile"
                              type="file"
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="h-auto py-2 cursor-pointer mt-0 w-full text-sm text-ink-600"
                            />
                          </div>
                        </div>
                      </fieldset>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Label htmlFor="attachmentDisplayName">Display name (optional)</Label>
                          <Input id="attachmentDisplayName" name="attachmentDisplayName" placeholder="e.g. Muskan_CV.pdf" className="mt-1.5" />
                        </div>
                        <div>
                          <Label htmlFor="attachmentCategory">Category</Label>
                          <Select id="attachmentCategory" name="attachmentCategory" defaultValue="Resume" className="mt-1.5">
                            <option value="Resume">Resume</option>
                            <option value="Cover letter">Cover letter</option>
                            <option value="Other">Other</option>
                          </Select>
                        </div>
                      </div>
                      <Button type="submit" variant="accent" className="justify-self-start">
                        Attach
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section id="section-tags" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-ink-500">No tags on this submission yet.</p>
                </CardContent>
              </Card>
            </section>

            <section id="section-reviews" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle>Ratings and reviews</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {app.reviews.length === 0 ? (
                    <p className="text-sm text-ink-500">No feedback logged on this submission yet.</p>
                  ) : (
                    <ul className="space-y-4">
                      {app.reviews.map((r) => {
                        const by = r.author.name ?? r.author.email ?? "—";
                        const edited = r.updatedAt && r.updatedAt.getTime() !== r.createdAt.getTime();
                        return (
                          <li key={r.id} className="rounded-xl border border-ink-100 bg-white p-4">
                            <div className="flex flex-wrap items-baseline gap-2 gap-y-1 text-xs text-ink-400">
                              <span className="font-semibold uppercase tracking-wide text-sky-800">Feedback</span>
                              <span>{formatDate(r.createdAt)}</span>
                              <span>· {by}</span>
                              {r.rating !== null ? (
                                <span className="tabular-nums text-ink-600">Rating {r.rating}/5</span>
                              ) : null}
                              {edited ? <span className="text-ink-400">· edited {formatDate(r.updatedAt)}</span> : null}
                            </div>
                            <p className="text-sm text-ink-700 whitespace-pre-wrap mt-2">{r.comment}</p>
                            <details className="mt-3 rounded-lg border border-ink-100 bg-ink-50/40">
                              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-ink-600 hover:text-ink-800 select-none">
                                Edit feedback
                              </summary>
                              <div className="border-t border-ink-100 px-3 py-3">
                                <form
                                  action={updateReviewAction.bind(null, r.id)}
                                  className="space-y-4 max-w-xl"
                                >
                                  <input type="hidden" name="returnPath" value={detailReturnPath} />
                                  <div>
                                    <Label htmlFor={`rating-${r.id}`}>Rating (optional)</Label>
                                    <Select
                                      id={`rating-${r.id}`}
                                      name="rating"
                                      className="mt-1.5"
                                      defaultValue={r.rating === null ? "" : String(r.rating)}
                                    >
                                      <option value="">No rating</option>
                                      {[1, 2, 3, 4, 5].map((n) => (
                                        <option key={n} value={String(n)}>
                                          {n} —{" "}
                                          {n >= 5
                                            ? "Strong yes"
                                            : n >= 4
                                              ? "Positive"
                                              : n >= 3
                                                ? "Mixed"
                                                : n >= 2
                                                  ? "Concerns"
                                                  : "Hard no"}
                                        </option>
                                      ))}
                                    </Select>
                                  </div>
                                  <div>
                                    <Label htmlFor={`comment-${r.id}`}>Written feedback</Label>
                                    <Textarea
                                      id={`comment-${r.id}`}
                                      name="comment"
                                      required
                                      rows={5}
                                      className="mt-1.5"
                                      defaultValue={r.comment}
                                    />
                                  </div>
                                  <Button type="submit" variant="accent" size="sm">
                                    Save changes
                                  </Button>
                                  <p className="text-[11px] text-ink-400 leading-relaxed">
                                    Saving edits will add an entry to the submission timeline.
                                  </p>
                                </form>
                                <div className="mt-4 pt-4 border-t border-ink-100">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700 mb-2">
                                    Danger zone
                                  </p>
                                  <DeleteReviewForm reviewId={r.id} returnPath={detailReturnPath} />
                                </div>
                              </div>
                            </details>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <form action={reviewAction} className="rounded-xl border border-ink-200 bg-ink-50/50 p-4 space-y-4 max-w-xl">
                    <input type="hidden" name="returnPath" value={detailReturnPath} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Add feedback</p>
                    <div>
                      <Label htmlFor="rating">Rating (optional)</Label>
                      <Select id="rating" name="rating" className="mt-1.5" defaultValue="">
                        <option value="">No rating</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={String(n)}>
                            {n} —{" "}
                            {n >= 5 ? "Strong yes" : n >= 4 ? "Positive" : n >= 3 ? "Mixed" : n >= 2 ? "Concerns" : "Hard no"}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="comment">Written feedback</Label>
                      <Textarea
                        id="comment"
                        name="comment"
                        required
                        rows={5}
                        className="mt-1.5"
                        placeholder="Panel notes, bar-raiser callouts, calibration…"
                      />
                    </div>
                    <Button type="submit" variant="accent">
                      Submit feedback
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </section>

            <section id="section-templates" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle>Questionnaire templates</CardTitle>
                    <Link
                      href="/hiring/templates?tab=questionnaire"
                      className="text-sm font-semibold text-sky-700 hover:underline shrink-0"
                    >
                      Manage templates →
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3">
                      Current stage — {app.pipelineStage.label}
                    </p>
                    {interviewTemplates.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50/50 p-4 text-sm text-ink-600">
                        No questionnaire templates for this stage yet.{" "}
                        <Link href="/hiring/templates?tab=questionnaire" className="font-semibold text-sky-700 hover:underline">
                          Create a template
                        </Link>{" "}
                        mapped to “{app.pipelineStage.label}”.
                      </div>
                    ) : (
                      <ul className="space-y-4">
                        {interviewTemplates.map((t) => (
                          <QuestionnaireTemplateCard key={t.id} title={t.title} body={t.body} />
                        ))}
                      </ul>
                    )}
                  </div>

                  {questionnairesByOtherStage.length > 0 ? (
                    <details className="rounded-xl border border-ink-100 bg-ink-50/30">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink-700 select-none">
                        All interview rounds (reference)
                      </summary>
                      <div className="px-4 pb-4 space-y-6 border-t border-ink-100 pt-4">
                        {questionnairesByOtherStage.map(({ stage, templates }) => (
                          <div key={stage.id}>
                            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">
                              {stage.label}
                            </p>
                            <ul className="space-y-3">
                              {templates.map((t) => (
                                <QuestionnaireTemplateCard key={t.id} title={t.title} body={t.body} compact />
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
            </section>

            <section id="section-submissions" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle>Hiring manager submissions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-ink-500">No submissions yet.</p>
                  <Button type="button" variant="outline" size="sm" disabled className="opacity-60 cursor-not-allowed">
                    Submit to hiring manager (planned)
                  </Button>
                </CardContent>
              </Card>
            </section>

            <section id="section-emails" className="scroll-mt-24">
              <Card>
                <CardHeader>
                  <CardTitle>Emails</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {emailSent && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      Email sent to {app.candidate.email}.
                    </div>
                  )}
                  {emailError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                      {decodeURIComponent(emailError)}
                    </div>
                  )}
                  <HiringApplicationEmailComposer
                    applicationId={applicationId}
                    candidateEmail={app.candidate.email}
                    mergeContext={emailMergeContext}
                    templates={emailTemplateOptions}
                    sentEmails={sentEmails}
                    canSend={canSendHiringEmail}
                    stageFlags={{
                      isRejected: app.pipelineStage.isRejected,
                      isHired: app.pipelineStage.isHired,
                    }}
                  />
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionnaireTemplateCard({
  title,
  body,
  compact,
}: {
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <li
      className={cn(
        "rounded-xl border border-ink-100 bg-white p-4",
        compact && "p-3",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className={cn("font-semibold text-ink-800", compact && "text-sm")}>{title}</span>
        <CopyTextButton label="Copy content" copiedLabel="Copied!" text={`${title}\n\n${body}`} />
      </div>
      <pre
        className={cn(
          "text-sm text-ink-600 whitespace-pre-wrap bg-ink-50/60 rounded-lg p-3 border border-ink-100 overflow-auto",
          compact ? "max-h-[180px]" : "max-h-[280px]",
        )}
      >
        {body}
      </pre>
    </li>
  );
}

function SummaryItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      <div className="text-ink-800 mt-0.5">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-semibold text-ink-400">{label}</div>
      <div className="text-ink-800 break-all">{value}</div>
    </div>
  );
}
