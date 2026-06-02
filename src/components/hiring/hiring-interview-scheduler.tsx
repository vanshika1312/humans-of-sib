"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { scheduleHiringInterview } from "@/app/(app)/hiring/applications/interview-actions";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type InterviewerOption = {
  id: string;
  name: string;
  email: string;
};

export type ScheduledInterviewRow = {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  timezone: string;
  title: string;
  locationOrLink: string | null;
  googleCalendarHtmlLink: string | null;
  interviewerUserIds: string[];
  scheduledBy: { name: string | null; email: string | null };
};

export type ApplicationAttachmentOption = {
  id: string;
  fileName: string;
  category: string;
  /** True when the file can be uploaded to Drive as a calendar attachment. */
  canAttachToCalendar: boolean;
};

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Dubai", label: "UAE (GST)" },
  { value: "Europe/London", label: "UK" },
  { value: "America/New_York", label: "US Eastern" },
];

export function HiringInterviewScheduleTrigger({
  applicationId,
  candidateName,
  jobTitle,
  interviewers,
  scheduledInterviews,
  applicationAttachments,
  candidateResumeUrl,
  canSchedule,
  calendarConfigured,
}: {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  interviewers: InterviewerOption[];
  scheduledInterviews: ScheduledInterviewRow[];
  applicationAttachments: ApplicationAttachmentOption[];
  candidateResumeUrl: string | null;
  canSchedule: boolean;
  calendarConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const scheduleAction = scheduleHiringInterview.bind(null, applicationId);
  const interviewerById = new Map(interviewers.map((u) => [u.id, u]));
  const hasResume = Boolean(candidateResumeUrl?.trim());
  const scheduledCount = scheduledInterviews.length;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!canSchedule) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative size-8 px-0"
        aria-label={
          scheduledCount > 0
            ? `Schedule interview (${scheduledCount} scheduled)`
            : "Schedule interview"
        }
        title="Schedule interview"
      >
        <Calendar className="size-4 text-sky-700" aria-hidden />
        {scheduledCount > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
            {scheduledCount > 9 ? "9+" : scheduledCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-hidden
            className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-interview-title"
            className="absolute left-1/2 top-8 bottom-8 w-[min(94vw,560px)] -translate-x-1/2 flex flex-col rounded-2xl border border-ink-100 bg-white shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-4 shrink-0">
              <div>
                <h2 id="schedule-interview-title" className="text-lg font-semibold text-ink-800">
                  Schedule interview
                </h2>
                <p className="text-sm text-ink-500 mt-0.5">
                  {candidateName} · {jobTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              {!calendarConfigured ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  Google Calendar is not configured. Add service account credentials and{" "}
                  <code className="text-xs bg-amber-100/80 px-1 rounded">GOOGLE_CALENDAR_ORGANIZER_EMAIL</code> to send
                  invites.
                </div>
              ) : null}

              {scheduledInterviews.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Scheduled</p>
                  <ul className="space-y-2">
                    {scheduledInterviews.map((iv) => {
                      const names = iv.interviewerUserIds
                        .map((id) => interviewerById.get(id)?.name ?? interviewerById.get(id)?.email)
                        .filter(Boolean);
                      return (
                        <li key={iv.id} className="rounded-xl border border-ink-100 bg-ink-50/40 p-3 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-ink-800">{iv.title}</p>
                              <p className="text-ink-600 mt-0.5 text-xs">
                                {formatDate(iv.scheduledAt)} · {iv.durationMinutes} min · {iv.timezone}
                              </p>
                              {names.length > 0 ? (
                                <p className="text-xs text-ink-500 mt-1">Interviewers: {names.join(", ")}</p>
                              ) : null}
                            </div>
                            {iv.googleCalendarHtmlLink ? (
                              <a
                                href={iv.googleCalendarHtmlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-sky-700 hover:underline shrink-0"
                              >
                                Calendar →
                              </a>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <form action={scheduleAction} encType="multipart/form-data" className="space-y-4">
                <p className="text-xs text-ink-500 leading-relaxed">
                  Creates a Google Calendar event and emails invites to{" "}
                  <strong className="font-medium text-ink-700">{candidateName}</strong>, selected interviewers, and
                  you.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="scheduledAtLocal">Date & time</Label>
                    <Input
                      id="scheduledAtLocal"
                      name="scheduledAtLocal"
                      type="datetime-local"
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select id="timezone" name="timezone" defaultValue="Asia/Kolkata" className="mt-1.5">
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="durationMinutes">Duration</Label>
                    <Select id="durationMinutes" name="durationMinutes" defaultValue="60" className="mt-1.5">
                      <option value="30">30 minutes</option>
                      <option value="45">45 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="90">90 minutes</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="locationOrLink">Meeting link or location (optional)</Label>
                    <Input
                      id="locationOrLink"
                      name="locationOrLink"
                      placeholder="https://meet.google.com/…"
                      className="mt-1.5"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes for calendar description (optional)</Label>
                  <Textarea id="notes" name="notes" rows={3} className="mt-1.5" placeholder="Agenda, panel focus, etc." />
                </div>

                <fieldset className="space-y-2 border-0 p-0 m-0">
                  <legend className="text-sm font-medium text-ink-700">Interviewers</legend>
                  <p className="text-[11px] text-ink-400">Candidate is always invited.</p>
                  {interviewers.length === 0 ? (
                    <p className="text-sm text-ink-500">No active team members found.</p>
                  ) : (
                    <ul className="max-h-36 overflow-y-auto rounded-lg border border-ink-100 bg-ink-50/30 divide-y divide-ink-100">
                      {interviewers.map((u) => (
                        <li key={u.id} className="px-3 py-2">
                          <label className="flex items-start gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              name="interviewerUserIds"
                              value={u.id}
                              className="mt-1 rounded border-ink-300"
                            />
                            <span>
                              <span className="font-medium text-ink-800">{u.name}</span>
                              <span className="block text-xs text-ink-500">{u.email}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </fieldset>

                <fieldset className="space-y-3 rounded-xl border border-ink-100 bg-ink-50/40 p-4 border-solid">
                  <legend className="text-sm font-medium text-ink-700 px-1">Calendar attachments</legend>
                  <p className="text-[11px] text-ink-500 -mt-1">
                    Files are uploaded to Google Drive and attached to the invite. External links are added to the event
                    description instead.
                  </p>

                  {hasResume ? (
                    <label className="flex items-start gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        name="includeResume"
                        defaultChecked
                        className="mt-1 rounded border-ink-300"
                      />
                      <span>
                        <span className="font-medium text-ink-800">Candidate résumé (profile)</span>
                        <span className="block text-xs text-ink-500">
                          Attached to the calendar invite when stored in this app; otherwise the link is added to the
                          event description.
                        </span>
                      </span>
                    </label>
                  ) : (
                    <p className="text-sm text-ink-500">No résumé on the candidate profile.</p>
                  )}

                  {applicationAttachments.length > 0 ? (
                    <ul className="space-y-2">
                      {applicationAttachments.map((a) => (
                        <li key={a.id}>
                          <label
                            className={cn(
                              "flex items-start gap-2 text-sm",
                              a.canAttachToCalendar ? "cursor-pointer" : "opacity-80",
                            )}
                          >
                            <input
                              type="checkbox"
                              name="attachmentIds"
                              value={a.id}
                              className="mt-1 rounded border-ink-300"
                            />
                            <span>
                              <span className="font-medium text-ink-800">{a.fileName}</span>
                              <span className="block text-xs text-ink-500">
                                {a.category}
                                {a.canAttachToCalendar ? "" : " · link added to description only"}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div>
                    <Label htmlFor="extraAttachments">Additional files (optional)</Label>
                    <Input
                      id="extraAttachments"
                      name="extraAttachments"
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="mt-1.5 text-sm"
                    />
                    <p className="text-[11px] text-ink-400 mt-1">PDF or Word, up to 12 MB each (max 5 files).</p>
                  </div>
                </fieldset>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-ink-100">
                  <Button type="submit" variant="accent" disabled={!calendarConfigured}>
                    Schedule & send invites
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
