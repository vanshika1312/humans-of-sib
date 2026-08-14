import { google } from "googleapis";
import { getGoogleWorkspaceJwt, googleApiErrorMessage } from "@/lib/google-workspace-auth";

const MEET_SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.settings",
  "https://www.googleapis.com/auth/meetings.space.readonly",
];

export type MeetSpaceInfo = {
  spaceName: string;
  meetingCode: string | null;
  meetingUri: string | null;
};

export type MeetConferenceArtifacts = {
  conferenceRecordName: string;
  recordingUrl: string | null;
  recordingDriveFileId: string | null;
  transcriptDocUrl: string | null;
  transcriptDocId: string | null;
  transcriptText: string | null;
};

function getMeetClient() {
  const auth = getGoogleWorkspaceJwt(MEET_SCOPES);
  return google.meet({ version: "v2", auth });
}

export function meetingCodeFromJoinUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
  return m?.[1]?.toLowerCase() ?? null;
}

export function meetSpaceNameFromCodeOrName(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (raw.startsWith("spaces/")) return raw;
  const code = meetingCodeFromJoinUrl(raw) ?? raw;
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(code)) return `spaces/${code.toLowerCase()}`;
  return `spaces/${code}`;
}

/**
 * Turns on auto-recording, transcription, and smart notes for a Meet space
 * (including spaces created via Google Calendar).
 */
export async function enableMeetAutoArtifacts(spaceNameOrCode: string): Promise<MeetSpaceInfo> {
  const meet = getMeetClient();
  const lookupName = meetSpaceNameFromCodeOrName(spaceNameOrCode);
  if (!lookupName) throw new Error("Missing Google Meet space.");

  const existing = await meet.spaces.get({ name: lookupName });
  const name = existing.data.name ?? lookupName;

  const res = await meet.spaces.patch({
    name,
    updateMask:
      "config.artifactConfig.recordingConfig.autoRecordingGeneration,config.artifactConfig.transcriptionConfig.autoTranscriptionGeneration,config.artifactConfig.smartNotesConfig.autoSmartNotesGeneration",
    requestBody: {
      config: {
        artifactConfig: {
          recordingConfig: { autoRecordingGeneration: "ON" },
          transcriptionConfig: { autoTranscriptionGeneration: "ON" },
          smartNotesConfig: { autoSmartNotesGeneration: "ON" },
        },
      },
    },
  });

  return {
    spaceName: res.data.name ?? name,
    meetingCode: res.data.meetingCode ?? existing.data.meetingCode ?? null,
    meetingUri: res.data.meetingUri ?? existing.data.meetingUri ?? null,
  };
}

export async function listLatestConferenceRecord(input: {
  spaceName?: string | null;
  meetingCode?: string | null;
}): Promise<{ name: string; endTime: string | null } | null> {
  const meet = getMeetClient();
  const filters: string[] = [];
  if (input.spaceName?.trim()) {
    filters.push(`space.name = "${input.spaceName.trim()}"`);
  } else if (input.meetingCode?.trim()) {
    filters.push(`space.meeting_code = "${input.meetingCode.trim().toLowerCase()}"`);
  }
  if (filters.length === 0) return null;

  const res = await meet.conferenceRecords.list({
    filter: filters[0],
    pageSize: 10,
  });
  const records = res.data.conferenceRecords ?? [];
  if (records.length === 0) return null;
  const first = records[0];
  if (!first.name) return null;
  return { name: first.name, endTime: first.endTime ?? null };
}

export async function fetchConferenceArtifacts(
  conferenceRecordName: string,
): Promise<Omit<MeetConferenceArtifacts, "transcriptText">> {
  const meet = getMeetClient();

  const [recordingsRes, transcriptsRes] = await Promise.all([
    meet.conferenceRecords.recordings.list({ parent: conferenceRecordName, pageSize: 10 }),
    meet.conferenceRecords.transcripts.list({ parent: conferenceRecordName, pageSize: 10 }),
  ]);

  const recordings = recordingsRes.data.recordings ?? [];
  const readyRecording =
    recordings.find((r) => r.state === "FILE_GENERATED") ?? recordings[0] ?? null;
  const transcripts = transcriptsRes.data.transcripts ?? [];
  const readyTranscript =
    transcripts.find((t) => t.state === "FILE_GENERATED") ?? transcripts[0] ?? null;

  return {
    conferenceRecordName,
    recordingUrl: readyRecording?.driveDestination?.exportUri ?? null,
    recordingDriveFileId: readyRecording?.driveDestination?.file ?? null,
    transcriptDocUrl: readyTranscript?.docsDestination?.exportUri ?? null,
    transcriptDocId: readyTranscript?.docsDestination?.document ?? null,
  };
}

export async function fetchTranscriptEntriesText(conferenceRecordName: string): Promise<string | null> {
  const meet = getMeetClient();
  const transcriptsRes = await meet.conferenceRecords.transcripts.list({
    parent: conferenceRecordName,
    pageSize: 10,
  });
  const transcript = (transcriptsRes.data.transcripts ?? []).find((t) => t.name)?.name;
  if (!transcript) return null;

  const lines: string[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 40; i += 1) {
    const page = await meet.conferenceRecords.transcripts.entries.list({
      parent: transcript,
      pageSize: 100,
      pageToken,
    });
    for (const entry of page.data.transcriptEntries ?? []) {
      const text = entry.text?.trim();
      if (!text) continue;
      lines.push(text);
    }
    pageToken = page.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  const joined = lines.join("\n").trim();
  return joined || null;
}

export function meetApiErrorMessage(err: unknown): string {
  return googleApiErrorMessage(err);
}
