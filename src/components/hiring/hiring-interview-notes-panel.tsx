import type { HiringInterviewArtifactStatus, HiringInterviewStatus } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import {
  saveHiringInterviewNotes,
  syncHiringInterviewFromMeet,
} from "@/app/(app)/hiring/applications/interview-actions";
import { isSafeHttpUrl } from "@/lib/hiring-http-url";
import { HiringInterviewScheduleTrigger, type InterviewerOption } from "@/components/hiring/hiring-interview-scheduler";
import type { ApplicationAttachmentOption, ScheduledInterviewRow } from "@/components/hiring/hiring-interview-scheduler";

export type InterviewNotesRow = {
  id: string;
  applicationId: string;
  scheduledAt: Date;
  durationMinutes: number;
  timezone: string;
  title: string;
  status: HiringInterviewStatus;
  locationOrLink: string | null;
  googleCalendarHtmlLink: string | null;
  googleMeetJoinUrl: string | null;
  recordAndTranscribe: boolean;
  recordingStatus: HiringInterviewArtifactStatus;
  recordingUrl: string | null;
  transcriptStatus: HiringInterviewArtifactStatus;
  transcriptText: string | null;
  transcriptDocUrl: string | null;
  notesSummary: string | null;
  artifactError: string | null;
  interviewerUserIds: string[];
  jobTitle?: string;
};

const ARTIFACT_LABEL: Record<HiringInterviewArtifactStatus, string> = {
  NONE: "Not requested",
  PENDING: "Waiting after the call",
  AVAILABLE: "Ready",
  FAILED: "Not available",
};

function artifactTone(status: HiringInterviewArtifactStatus): string {
  if (status === "AVAILABLE") return "text-emerald-800";
  if (status === "FAILED") return "text-red-700";
  if (status === "PENDING") return "text-amber-800";
  return "text-ink-500";
}

export function HiringInterviewNotesPanel({
  interviews,
  interviewerOptions,
  canManage,
  returnPath,
  scheduleProps,
}: {
  interviews: InterviewNotesRow[];
  interviewerOptions: InterviewerOption[];
  canManage: boolean;
  returnPath: string;
  scheduleProps?: {
    applicationId: string;
    candidateName: string;
    jobTitle: string;
    interviewers: InterviewerOption[];
    scheduledInterviews: ScheduledInterviewRow[];
    applicationAttachments: ApplicationAttachmentOption[];
    candidateResumeUrl: string | null;
    calendarConfigured: boolean;
  };
}) {
  const interviewerById = new Map(interviewerOptions.map((u) => [u.id, u]));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Interviews, recordings & notes</CardTitle>
            <CardDescription>
              Schedule a Google Calendar / Meet interview. After a recorded call, pull the transcript and save notes to
              the candidate profile.
            </CardDescription>
          </div>
          {scheduleProps && canManage ? (
            <HiringInterviewScheduleTrigger
              {...scheduleProps}
              canSchedule={canManage}
              showLabel
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {interviews.length === 0 ? (
          <p className="text-sm text-ink-500">No interviews scheduled yet.</p>
        ) : (
          <ul className="space-y-4">
            {interviews.map((iv) => {
              const names = iv.interviewerUserIds
                .map((id) => interviewerById.get(id)?.name ?? interviewerById.get(id)?.email)
                .filter(Boolean);
              const meetUrl = iv.googleMeetJoinUrl || iv.locationOrLink;
              const saveAction = saveHiringInterviewNotes.bind(null, iv.applicationId, iv.id);
              const syncAction = syncHiringInterviewFromMeet.bind(null, iv.applicationId, iv.id);
              return (
                <li key={iv.id} className="rounded-xl border border-ink-100 bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-800">{iv.title}</p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {formatDate(iv.scheduledAt, { hour: "2-digit", minute: "2-digit" })} · {iv.durationMinutes} min ·{" "}
                        {iv.timezone}
                        {iv.jobTitle ? ` · ${iv.jobTitle}` : ""}
                      </p>
                      {names.length > 0 ? (
                        <p className="text-xs text-ink-500 mt-1">Interviewers: {names.join(", ")}</p>
                      ) : null}
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400 shrink-0">
                      {iv.status === "CANCELLED" ? "Cancelled" : iv.status === "COMPLETED" ? "Completed" : "Scheduled"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {iv.googleCalendarHtmlLink && isSafeHttpUrl(iv.googleCalendarHtmlLink) ? (
                      <a
                        href={iv.googleCalendarHtmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sky-700 hover:underline"
                      >
                        Google Calendar
                      </a>
                    ) : null}
                    {meetUrl && isSafeHttpUrl(meetUrl) ? (
                      <a
                        href={meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sky-700 hover:underline"
                      >
                        Join Meet
                      </a>
                    ) : null}
                    {iv.recordingUrl && isSafeHttpUrl(iv.recordingUrl) ? (
                      <a
                        href={iv.recordingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sky-700 hover:underline"
                      >
                        Recording
                      </a>
                    ) : null}
                    {iv.transcriptDocUrl && isSafeHttpUrl(iv.transcriptDocUrl) ? (
                      <a
                        href={iv.transcriptDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sky-700 hover:underline"
                      >
                        Transcript doc
                      </a>
                    ) : null}
                  </div>

                  {iv.recordAndTranscribe ? (
                    <p className="text-xs text-ink-600">
                      Recording:{" "}
                      <span className={artifactTone(iv.recordingStatus)}>{ARTIFACT_LABEL[iv.recordingStatus]}</span>
                      {" · "}
                      Transcript:{" "}
                      <span className={artifactTone(iv.transcriptStatus)}>{ARTIFACT_LABEL[iv.transcriptStatus]}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-ink-500">Recording was not requested for this interview.</p>
                  )}

                  {iv.artifactError ? (
                    <p className="text-xs text-amber-900 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      {iv.artifactError}
                    </p>
                  ) : null}

                  {iv.transcriptText ? (
                    <details className="rounded-lg border border-ink-100 bg-ink-50/40">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-600 select-none">
                        Transcript
                      </summary>
                      <pre className="px-3 pb-3 text-xs text-ink-700 whitespace-pre-wrap max-h-64 overflow-auto">
                        {iv.transcriptText}
                      </pre>
                    </details>
                  ) : null}

                  {canManage ? (
                    <div className="space-y-3 border-t border-ink-100 pt-3">
                      <form action={saveAction} className="space-y-3">
                        <input type="hidden" name="returnPath" value={returnPath} />
                        <div>
                          <Label htmlFor={`notesSummary-${iv.id}`}>Notes (saved on candidate profile)</Label>
                          <Textarea
                            id={`notesSummary-${iv.id}`}
                            name="notesSummary"
                            rows={6}
                            defaultValue={iv.notesSummary ?? ""}
                            className="mt-1.5"
                            placeholder="Summary, strengths, concerns, recommendation…"
                          />
                        </div>
                        {!iv.transcriptText ? (
                          <div>
                            <Label htmlFor={`transcriptText-${iv.id}`}>Paste transcript (optional)</Label>
                            <Textarea
                              id={`transcriptText-${iv.id}`}
                              name="transcriptText"
                              rows={4}
                              className="mt-1.5"
                              placeholder="If Google Meet transcription is unavailable, paste notes or a transcript here."
                            />
                          </div>
                        ) : null}
                        <Button type="submit" variant="accent" size="sm">
                          Save notes to profile
                        </Button>
                      </form>
                      {iv.recordAndTranscribe ? (
                        <form action={syncAction}>
                          <input type="hidden" name="returnPath" value={returnPath} />
                          <Button type="submit" variant="outline" size="sm">
                            Pull recording & transcript from Meet
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : iv.notesSummary ? (
                    <p className="text-sm text-ink-700 whitespace-pre-wrap border-t border-ink-100 pt-3">
                      {iv.notesSummary}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
