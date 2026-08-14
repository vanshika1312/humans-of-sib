import { prisma } from "@/lib/prisma";
import { resolveLiaLlmConfig } from "@/lib/lia-config";
import { exportGoogleDocPlainText } from "@/lib/google-drive";
import {
  fetchConferenceArtifacts,
  fetchTranscriptEntriesText,
  listLatestConferenceRecord,
  meetingCodeFromJoinUrl,
  meetApiErrorMessage,
} from "@/lib/google-meet";
import type { HiringInterview, HiringInterviewArtifactStatus } from "@/generated/prisma";

const INTERVIEW_NOTE_MARKER = (interviewId: string) => `[interview:${interviewId}]`;

export type InterviewArtifactSyncResult = {
  ok: boolean;
  message: string;
  recordingStatus: HiringInterviewArtifactStatus;
  transcriptStatus: HiringInterviewArtifactStatus;
};

function interviewEndedAt(interview: Pick<HiringInterview, "scheduledAt" | "durationMinutes">): Date {
  return new Date(interview.scheduledAt.getTime() + interview.durationMinutes * 60_000);
}

export function upsertInterviewNotesOnCandidateProfile(
  existing: string | null | undefined,
  interviewId: string,
  heading: string,
  notes: string,
): string {
  const marker = INTERVIEW_NOTE_MARKER(interviewId);
  const block = `${marker}\n${heading}\n${notes.trim()}`.trim();
  const current = existing?.trim() ?? "";
  if (!current) return block;
  const re = new RegExp(
    `\\[interview:${interviewId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\][\\s\\S]*?(?=\\n\\[interview:|$)`,
  );
  if (re.test(current)) return current.replace(re, block).trim();
  return `${current}\n\n${block}`.trim();
}

async function summarizeInterviewTranscript(input: {
  candidateName: string;
  jobTitle: string;
  transcript: string;
}): Promise<string | null> {
  const cfg = resolveLiaLlmConfig();
  if (!cfg) return null;

  const chatUrl = `${cfg.baseNormalized.replace(/\/$/, "")}/chat/completions`;
  const transcript = input.transcript.trim().slice(0, 20_000);
  if (!transcript) return null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.apiKey}`,
    "Content-Type": "application/json",
  };
  if (cfg.isOpenRouter) {
    headers["X-Title"] = "Humans of SIB - interview notes";
  }

  try {
    const response = await fetch(chatUrl, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You write concise hiring interview notes for an internal ATS. Use short markdown sections: Summary, Strengths, Concerns, Recommendation. Do not invent facts not in the transcript. 180–350 words.",
          },
          {
            role: "user",
            content: `Candidate: ${input.candidateName}\nRole: ${input.jobTitle}\n\nTranscript:\n${transcript}`,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content?.trim();
    return content ? content.slice(0, 8000) : null;
  } catch {
    return null;
  }
}

async function persistNotesOnCandidate(input: {
  candidateId: string;
  interviewId: string;
  heading: string;
  notes: string;
}) {
  const candidate = await prisma.hiringCandidate.findUnique({
    where: { id: input.candidateId },
    select: { notes: true },
  });
  if (!candidate) return;
  const next = upsertInterviewNotesOnCandidateProfile(
    candidate.notes,
    input.interviewId,
    input.heading,
    input.notes,
  );
  if (next === (candidate.notes ?? "").trim()) return;
  await prisma.hiringCandidate.update({
    where: { id: input.candidateId },
    data: { notes: next },
  });
}

export async function syncHiringInterviewArtifacts(interviewId: string): Promise<InterviewArtifactSyncResult> {
  const interview = await prisma.hiringInterview.findUnique({
    where: { id: interviewId },
    include: {
      application: {
        select: {
          candidateId: true,
          candidate: { select: { fullName: true } },
          job: { select: { title: true } },
        },
      },
    },
  });

  if (!interview) {
    return {
      ok: false,
      message: "Interview not found.",
      recordingStatus: "NONE",
      transcriptStatus: "NONE",
    };
  }

  if (!interview.recordAndTranscribe) {
    return {
      ok: true,
      message: "Recording was not requested for this interview.",
      recordingStatus: interview.recordingStatus,
      transcriptStatus: interview.transcriptStatus,
    };
  }

  const meetingCode =
    meetingCodeFromJoinUrl(interview.googleMeetJoinUrl) ??
    meetingCodeFromJoinUrl(interview.locationOrLink);
  const spaceName = interview.googleMeetSpaceName;

  if (!spaceName && !meetingCode) {
    await prisma.hiringInterview.update({
      where: { id: interviewId },
      data: {
        recordingStatus: "FAILED",
        transcriptStatus: "FAILED",
        artifactError: "No Google Meet link on this interview, so recording cannot be fetched.",
      },
    });
    return {
      ok: false,
      message: "No Google Meet link on this interview.",
      recordingStatus: "FAILED",
      transcriptStatus: "FAILED",
    };
  }

  try {
    const record = await listLatestConferenceRecord({ spaceName, meetingCode });
    if (!record) {
      const endedAgoMs = Date.now() - interviewEndedAt(interview).getTime();
      const tooOld = endedAgoMs > 8 * 60 * 60_000;
      const data = {
        recordingStatus: tooOld ? ("FAILED" as const) : ("PENDING" as const),
        transcriptStatus: tooOld ? ("FAILED" as const) : ("PENDING" as const),
        artifactError: tooOld
          ? "No Google Meet conference was found after the scheduled end time. The meeting may not have started, or Meet API access is missing."
          : null,
      };
      await prisma.hiringInterview.update({ where: { id: interviewId }, data });
      return {
        ok: !tooOld,
        message: tooOld
          ? data.artifactError!
          : "Waiting for the Google Meet to finish. Recording and transcript usually appear a few minutes after the call.",
        recordingStatus: data.recordingStatus,
        transcriptStatus: data.transcriptStatus,
      };
    }

    const artifacts = await fetchConferenceArtifacts(record.name);
    let transcriptText =
      interview.transcriptText?.trim() || (await fetchTranscriptEntriesText(record.name));
    if (!transcriptText && artifacts.transcriptDocId) {
      try {
        transcriptText = await exportGoogleDocPlainText(artifacts.transcriptDocId);
      } catch (err) {
        console.error("[Humans of SIB] interview transcript doc export failed", err);
      }
    }

    const recordingReady = Boolean(artifacts.recordingUrl);
    const transcriptReady = Boolean(transcriptText?.trim() || artifacts.transcriptDocUrl);
    const conferenceEnded = Boolean(record.endTime);

    let notesSummary = interview.notesSummary;
    let notesSummarySource = interview.notesSummarySource;
    if (
      transcriptText?.trim() &&
      (!notesSummary?.trim() || notesSummarySource === "auto")
    ) {
      const summary = await summarizeInterviewTranscript({
        candidateName: interview.application.candidate.fullName,
        jobTitle: interview.application.job.title,
        transcript: transcriptText,
      });
      if (summary) {
        notesSummary = summary;
        notesSummarySource = "auto";
      }
    }

    const recordingStatus: HiringInterviewArtifactStatus = recordingReady
      ? "AVAILABLE"
      : conferenceEnded
        ? "FAILED"
        : "PENDING";
    const transcriptStatus: HiringInterviewArtifactStatus = transcriptReady
      ? "AVAILABLE"
      : conferenceEnded
        ? "FAILED"
        : "PENDING";

    const done = recordingReady || transcriptReady;
    await prisma.hiringInterview.update({
      where: { id: interviewId },
      data: {
        googleMeetConferenceRecordName: record.name,
        recordingStatus,
        recordingUrl: artifacts.recordingUrl ?? interview.recordingUrl,
        recordingDriveFileId: artifacts.recordingDriveFileId ?? interview.recordingDriveFileId,
        transcriptStatus,
        transcriptText: transcriptText ?? interview.transcriptText,
        transcriptDocUrl: artifacts.transcriptDocUrl ?? interview.transcriptDocUrl,
        notesSummary,
        notesSummarySource,
        notesSyncedAt: done ? new Date() : interview.notesSyncedAt,
        artifactError: done
          ? null
          : conferenceEnded
            ? "The Meet ended but Google has not produced a recording or transcript yet (Workspace recording may be off, or artifacts are still processing)."
            : null,
        status:
          interview.status === "CANCELLED"
            ? interview.status
            : done || conferenceEnded
              ? "COMPLETED"
              : interview.status,
      },
    });

    if (notesSummary?.trim()) {
      const when = interview.scheduledAt.toISOString().slice(0, 10);
      await persistNotesOnCandidate({
        candidateId: interview.application.candidateId,
        interviewId: interview.id,
        heading: `Interview notes · ${when} · ${interview.application.job.title}`,
        notes: notesSummary,
      });
      if (!interview.notesSummary?.trim()) {
        await prisma.hiringActivity.create({
          data: {
            kind: "APPLICATION_INTERVIEW_NOTES_SAVED",
            applicationId: interview.applicationId,
            candidateId: interview.application.candidateId,
            summary: `Interview notes saved · ${interview.title}`,
            payloadJson: JSON.stringify({
              interviewId: interview.id,
              title: interview.title,
              notesPreview: notesSummary.slice(0, 280),
              source: "auto",
            }),
          },
        });
      }
    }

    if (done) {
      return {
        ok: true,
        message: "Recording and notes pulled from Google Meet.",
        recordingStatus,
        transcriptStatus,
      };
    }

    return {
      ok: true,
      message: conferenceEnded
        ? "Meet ended; Google has not finished the recording or transcript yet."
        : "Meet is still in progress or artifacts are processing.",
      recordingStatus,
      transcriptStatus,
    };
  } catch (err) {
    const message = meetApiErrorMessage(err);
    console.error("[Humans of SIB] interview artifact sync failed", err);
    await prisma.hiringInterview.update({
      where: { id: interviewId },
      data: { artifactError: message.slice(0, 1000) },
    });
    return {
      ok: false,
      message,
      recordingStatus: interview.recordingStatus,
      transcriptStatus: interview.transcriptStatus,
    };
  }
}

export async function syncDueHiringInterviewArtifacts(): Promise<{
  checked: number;
  synced: number;
  errors: number;
}> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 14 * 24 * 60 * 60_000);
  const graceEndedBefore = new Date(now.getTime() - 8 * 60_000);

  const due = await prisma.hiringInterview.findMany({
    where: {
      recordAndTranscribe: true,
      status: { not: "CANCELLED" },
      scheduledAt: { gte: windowStart, lte: graceEndedBefore },
      OR: [
        { recordingStatus: { in: ["NONE", "PENDING"] } },
        { transcriptStatus: { in: ["NONE", "PENDING"] } },
      ],
    },
    select: { id: true, scheduledAt: true, durationMinutes: true },
    take: 40,
    orderBy: { scheduledAt: "asc" },
  });

  const ready = due.filter((row) => interviewEndedAt(row).getTime() <= graceEndedBefore.getTime());

  let synced = 0;
  let errors = 0;
  for (const row of ready) {
    const result = await syncHiringInterviewArtifacts(row.id);
    if (result.ok) synced += 1;
    else errors += 1;
  }

  return { checked: ready.length, synced, errors };
}
