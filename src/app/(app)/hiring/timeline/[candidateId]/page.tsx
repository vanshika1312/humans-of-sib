import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { HiringActivityPayloadBlock } from "@/components/hiring/hiring-activity-payload";
import { ResumeAutofillPanel } from "@/components/hiring/resume-autofill-panel";
import { HIRING_ACTIVITY_KIND_LABEL } from "@/lib/hiring-activity-kind-copy";
import { updateHiringCandidate } from "../../actions";
import { firstSearchParam } from "@/lib/search-param";
import { HiringInterviewNotesPanel } from "@/components/hiring/hiring-interview-notes-panel";
import { displayName } from "@/lib/user-display-name";

type Props = {
  params: Promise<{ candidateId: string }>;
  searchParams: Promise<{
    saved?: string | string[];
    error?: string | string[];
    interviewSynced?: string | string[];
    interviewNotesSaved?: string | string[];
    interviewError?: string | string[];
  }>;
};

export default async function CandidateTimelinePage(props: Props) {
  const { candidateId } = await props.params;
  const sp = await props.searchParams;
  const flashError = firstSearchParam(sp.error) ?? firstSearchParam(sp.interviewError);
  const flashSaved = firstSearchParam(sp.saved) === "1";
  const interviewSynced = firstSearchParam(sp.interviewSynced) === "1";
  const interviewNotesSaved = firstSearchParam(sp.interviewNotesSaved) === "1";

  const candidate = await prisma.hiringCandidate.findUnique({
    where: { id: candidateId },
    include: {
      applications: {
        orderBy: { appliedAt: "desc" },
        include: {
          job: { select: { title: true, id: true } },
          interviews: {
            orderBy: { scheduledAt: "desc" },
            include: { scheduledBy: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });

  if (!candidate) notFound();

  const [events, interviewerUsers] = await Promise.all([
    prisma.hiringActivity.findMany({
      where: { candidateId },
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.user.findMany({
      where: { invitationPending: false },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, firstName: true, lastName: true, email: true },
      take: 300,
    }),
  ]);

  const interviewRows = candidate.applications.flatMap((a) =>
    a.interviews.map((iv) => ({
      id: iv.id,
      applicationId: a.id,
      scheduledAt: iv.scheduledAt,
      durationMinutes: iv.durationMinutes,
      timezone: iv.timezone,
      title: iv.title,
      status: iv.status,
      locationOrLink: iv.locationOrLink,
      googleCalendarHtmlLink: iv.googleCalendarHtmlLink,
      googleMeetJoinUrl: iv.googleMeetJoinUrl,
      recordAndTranscribe: iv.recordAndTranscribe,
      recordingStatus: iv.recordingStatus,
      recordingUrl: iv.recordingUrl,
      transcriptStatus: iv.transcriptStatus,
      transcriptText: iv.transcriptText,
      transcriptDocUrl: iv.transcriptDocUrl,
      notesSummary: iv.notesSummary,
      artifactError: iv.artifactError,
      interviewerUserIds: iv.interviewerUserIds,
      jobTitle: a.job.title,
    })),
  );

  const action = updateHiringCandidate.bind(null, candidateId);

  return (
    <div className="space-y-8 max-w-3xl pb-10">
      <PageHeader
        title="Candidate timeline"
        emoji="🕘"
        subtitle={`${candidate.fullName} · ${candidate.email}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/hiring/applications">
              <Button variant="outline" size="md">
                Applications
              </Button>
            </Link>
            <Link href="/hiring/candidates/new">
              <Button variant="ghost" size="md">
                New candidate →
              </Button>
            </Link>
          </div>
        }
      />

      {flashSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Profile saved — timeline updated.
        </div>
      )}
      {interviewNotesSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Interview notes saved on this candidate profile.
        </div>
      )}
      {interviewSynced && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Recording and transcript sync attempted.
        </div>
      )}
      {flashError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {decodeURIComponent(flashError)}
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <CardTitle>Edit profile</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <form action={action} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                required
                defaultValue={candidate.fullName}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                defaultValue={candidate.email}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" defaultValue={candidate.phone ?? ""} className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="candidateLocation">Candidate location</Label>
              <Input
                id="candidateLocation"
                name="candidateLocation"
                defaultValue={candidate.candidateLocation ?? ""}
                className="mt-1.5"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="source">Source</Label>
              <Input id="source" name="source" defaultValue={candidate.source ?? ""} className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="resumeDriveUrl">Résumé link (e.g. Google Drive)</Label>
              <Input
                id="resumeDriveUrl"
                name="resumeDriveUrl"
                defaultValue={candidate.resumeUrl ?? ""}
                className="mt-1.5"
                placeholder="Paste a shared link, or leave as-is when uploading a file"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="portfolioUrl">Portfolio URL (optional)</Label>
              <Input
                id="portfolioUrl"
                name="portfolioUrl"
                defaultValue={candidate.portfolioUrl ?? ""}
                className="mt-1.5"
                placeholder="https://github.com/… or a personal site"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="resumeFile">Replace résumé file (PDF, Word)</Label>
              <ResumeAutofillPanel
                inputId="resumeFile"
                inputName="resumeFile"
                fieldIds={{
                  fullName: "fullName",
                  email: "email",
                  phone: "phone",
                  candidateLocation: "candidateLocation",
                }}
                fillMode="overwrite"
                helperText="Upload overrides the pasted link once saved — we'll also re-read it and refresh the fields above, plus this candidate's ATS scores on every open application."
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={4} defaultValue={candidate.notes ?? ""} className="mt-1.5" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="accent">
                Save profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <HiringInterviewNotesPanel
        interviews={interviewRows}
        interviewerOptions={interviewerUsers.map((u) => ({
          id: u.id,
          name: displayName(u),
          email: u.email,
        }))}
        canManage
        returnPath={`/hiring/timeline/${candidateId}`}
      />

      <Card>
        <CardHeader>
          <CardTitle>Openings ({candidate.applications.length})</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          {candidate.applications.length === 0 ? (
            <p className="text-ink-500">No applications yet.</p>
          ) : (
            <ul className="space-y-2">
              {candidate.applications.map((a) => (
                <li key={a.id}>
                  <Link href={`/hiring/jobs/${a.job.id}`} className="font-medium text-sky-700 hover:underline">
                    {a.job.title}
                  </Link>
                  <span className="text-ink-400 text-xs ml-2">applied {formatDate(a.appliedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-ink-100">
          <CardTitle>Activity timeline</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {events.length === 0 ? (
            <p className="text-sm text-ink-500">No audit events yet.</p>
          ) : (
            <ul className="space-y-4">
              {events.map((ev) => (
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
                    <HiringActivityPayloadBlock kind={ev.kind} payloadJson={ev.payloadJson} timelineSurface />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
