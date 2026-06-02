"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createInterviewCalendarEvent, googleCalendarConfigured } from "@/lib/google-calendar";
import { uploadFileForCalendarAttachment } from "@/lib/google-drive";
import { zonedLocalDateTimeToUtc } from "@/lib/eod/zoned-day";
import { loadHiringStoredFileBuffer, mimeTypeFromFileName } from "@/lib/hiring-stored-file";
import { isBulkImportStoredResumeUrl } from "@/lib/hiring-resume-upload";

const HR_GATE = ["CEO", "ADMIN", "HR"];

const DURATION_OPTIONS = [30, 45, 60, 90] as const;
const MAX_EXTRA_FILES = 5;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

async function requireHiringInterviewUser() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !HR_GATE.includes(me.role)) redirect("/home");
  return me;
}

function applicationDetailPath(applicationId: string, params: Record<string, string>) {
  const q = new URLSearchParams(params);
  return `/hiring/applications/${applicationId}?${q.toString()}`;
}

function parseInterviewerIds(formData: FormData): string[] {
  const raw = formData.getAll("interviewerUserIds");
  const ids = raw.map((v) => String(v).trim()).filter(Boolean);
  return [...new Set(ids)];
}

function parseDuration(formData: FormData): number {
  const n = Number(String(formData.get("durationMinutes") ?? "60"));
  return (DURATION_OPTIONS as readonly number[]).includes(n) ? n : 60;
}

function parseAttachmentIds(formData: FormData): string[] {
  const raw = formData.getAll("attachmentIds");
  return [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))];
}

function checkboxOn(formData: FormData, name: string): boolean {
  const v = String(formData.get(name) ?? "").trim().toLowerCase();
  return v === "on" || v === "true" || v === "1";
}

type FileCandidate = { buffer: Buffer; fileName: string; mimeType: string };

async function bufferFromUploadedFile(file: File): Promise<FileCandidate | null> {
  if (!(file instanceof File) || file.size <= 0) return null;
  if (file.size > MAX_FILE_BYTES) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.trim() || "attachment";
  return {
    buffer: buf,
    fileName,
    mimeType: file.type?.trim() || mimeTypeFromFileName(fileName),
  };
}

async function collectInterviewAttachmentFiles(
  applicationId: string,
  candidateResumeUrl: string | null | undefined,
  formData: FormData,
): Promise<{ files: FileCandidate[]; linkOnlyUrls: string[]; errors: string[] }> {
  const files: FileCandidate[] = [];
  const linkOnlyUrls: string[] = [];
  const errors: string[] = [];

  const includeResume = checkboxOn(formData, "includeResume");
  if (includeResume && candidateResumeUrl?.trim()) {
    const url = candidateResumeUrl.trim();
    const loaded = await loadHiringStoredFileBuffer(url, "candidate-resume");
    if (loaded.ok) {
      files.push({
        buffer: loaded.buffer,
        fileName: loaded.fileName,
        mimeType: mimeTypeFromFileName(loaded.fileName),
      });
    } else if (!isBulkImportStoredResumeUrl(url)) {
      linkOnlyUrls.push(url);
    } else {
      errors.push(loaded.error);
    }
  }

  const attachmentIds = parseAttachmentIds(formData);
  if (attachmentIds.length > 0) {
    const rows = await prisma.hiringApplicationAttachment.findMany({
      where: { applicationId, id: { in: attachmentIds } },
      select: { id: true, fileName: true, url: true },
    });
    for (const row of rows) {
      const loaded = await loadHiringStoredFileBuffer(row.url, row.fileName);
      if (loaded.ok) {
        files.push({
          buffer: loaded.buffer,
          fileName: loaded.fileName,
          mimeType: mimeTypeFromFileName(loaded.fileName),
        });
      } else if (!isBulkImportStoredResumeUrl(row.url)) {
        linkOnlyUrls.push(row.url);
      } else {
        errors.push(`${row.fileName}: ${loaded.error}`);
      }
    }
  }

  const rawExtras = formData.getAll("extraAttachments");
  let extraCount = 0;
  for (const entry of rawExtras) {
    if (!(entry instanceof File) || entry.size <= 0) continue;
    if (extraCount >= MAX_EXTRA_FILES) break;
    const parsed = await bufferFromUploadedFile(entry);
    if (!parsed) {
      errors.push(`Skipped ${entry.name || "file"} (empty or over 12 MB).`);
      continue;
    }
    files.push(parsed);
    extraCount += 1;
  }

  return { files, linkOnlyUrls, errors };
}

export async function scheduleHiringInterview(applicationId: string, formData: FormData) {
  const me = await requireHiringInterviewUser();

  if (!googleCalendarConfigured()) {
    redirect(
      applicationDetailPath(applicationId, {
        interviewError: encodeURIComponent(
          "Google Calendar is not configured. Set GOOGLE_SERVICE_ACCOUNT_* and GOOGLE_CALENDAR_ORGANIZER_EMAIL.",
        ),
      }),
    );
  }

  const scheduledAtLocal = String(formData.get("scheduledAtLocal") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "Asia/Kolkata").trim() || "Asia/Kolkata";
  const durationMinutes = parseDuration(formData);
  const locationOrLink = String(formData.get("locationOrLink") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const interviewerUserIds = parseInterviewerIds(formData);

  if (!scheduledAtLocal) {
    redirect(
      applicationDetailPath(applicationId, {
        interviewError: encodeURIComponent("Date and time are required."),
      }),
    );
  }

  let scheduledAt: Date;
  try {
    scheduledAt = zonedLocalDateTimeToUtc(scheduledAtLocal, timezone);
  } catch {
    redirect(
      applicationDetailPath(applicationId, {
        interviewError: encodeURIComponent("Invalid date, time, or timezone."),
      }),
    );
  }

  if (scheduledAt.getTime() < Date.now() - 5 * 60_000) {
    redirect(
      applicationDetailPath(applicationId, {
        interviewError: encodeURIComponent("Interview must be scheduled in the future."),
      }),
    );
  }

  const app = await prisma.hiringApplication.findUnique({
    where: { id: applicationId },
    include: {
      candidate: { select: { email: true, fullName: true, resumeUrl: true } },
      job: { select: { title: true } },
      pipelineStage: { select: { label: true } },
    },
  });

  if (!app) {
    redirect(
      applicationDetailPath(applicationId, {
        interviewError: encodeURIComponent("Application not found."),
      }),
    );
  }

  const candidateEmail = app.candidate.email.trim().toLowerCase();
  if (!candidateEmail) {
    redirect(
      applicationDetailPath(applicationId, {
        interviewError: encodeURIComponent("Candidate has no email on file."),
      }),
    );
  }

  const interviewers = interviewerUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: interviewerUserIds }, invitationPending: false },
        select: { id: true, email: true, name: true },
      })
    : [];

  if (interviewerUserIds.length > 0 && interviewers.length === 0) {
    redirect(
      applicationDetailPath(applicationId, {
        interviewError: encodeURIComponent("Select at least one valid interviewer."),
      }),
    );
  }

  const { files: attachmentFiles, linkOnlyUrls, errors: attachmentErrors } =
    await collectInterviewAttachmentFiles(applicationId, app.candidate.resumeUrl, formData);

  const interviewerEmails = interviewers.map((u) => u.email.toLowerCase());
  const attendeeEmails = [...new Set([candidateEmail, ...interviewerEmails, me.email.toLowerCase()])];

  const title = `Interview: ${app.candidate.fullName} — ${app.job.title}`;
  const descriptionParts = [
    `Candidate: ${app.candidate.fullName} (${candidateEmail})`,
    `Role: ${app.job.title}`,
    `Stage: ${app.pipelineStage.label}`,
    notes ? `\nNotes:\n${notes}` : "",
    linkOnlyUrls.length
      ? `\nDocument links (open in browser):\n${linkOnlyUrls.map((u) => `• ${u}`).join("\n")}`
      : "",
    attachmentErrors.length ? `\nAttachment warnings:\n${attachmentErrors.map((e) => `• ${e}`).join("\n")}` : "",
  ];

  const calendarAttachments: Awaited<ReturnType<typeof uploadFileForCalendarAttachment>>[] = [];
  for (const file of attachmentFiles) {
    try {
      calendarAttachments.push(
        await uploadFileForCalendarAttachment(file.buffer, file.fileName, file.mimeType),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Drive upload failed";
      attachmentErrors.push(`${file.fileName}: ${msg}`);
    }
  }

  let calendar: { eventId: string; htmlLink: string | null };
  try {
    calendar = await createInterviewCalendarEvent({
      title,
      description: descriptionParts.filter(Boolean).join("\n"),
      locationOrLink,
      scheduledAt,
      durationMinutes,
      timezone,
      attendeeEmails,
      attachments: calendarAttachments,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not create calendar event.";
    console.error("[Humans of SIB] schedule interview calendar failed", err);
    redirect(
      applicationDetailPath(applicationId, {
        interviewError: encodeURIComponent(msg.slice(0, 400)),
      }),
    );
  }

  const interviewerNames = interviewers.map((u) => u.name ?? u.email);

  await prisma.$transaction(async (tx) => {
    await tx.hiringInterview.create({
      data: {
        applicationId,
        scheduledAt,
        durationMinutes,
        timezone,
        title,
        notes,
        locationOrLink,
        googleCalendarEventId: calendar.eventId,
        googleCalendarHtmlLink: calendar.htmlLink,
        interviewerUserIds: interviewers.map((u) => u.id),
        scheduledById: me.id,
      },
    });
    await tx.hiringActivity.create({
      data: {
        kind: "APPLICATION_INTERVIEW_SCHEDULED",
        applicationId,
        candidateId: app.candidateId,
        summary: `Interview scheduled · ${scheduledAtLocal.replace("T", " ")} (${timezone})`,
        payloadJson: JSON.stringify({
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes,
          timezone,
          candidateEmail,
          interviewerEmails,
          interviewerNames,
          locationOrLink,
          googleCalendarHtmlLink: calendar.htmlLink,
          attachmentCount: calendarAttachments.length,
          attachmentTitles: calendarAttachments.map((a) => a.title),
        }),
        actorUserId: me.id,
      },
    });
  });

  revalidatePath(`/hiring/applications/${applicationId}`);
  revalidatePath("/hiring/activity");
  redirect(applicationDetailPath(applicationId, { interviewScheduled: "1" }));
}
