import { Readable } from "node:stream";
import { google } from "googleapis";
import { getGoogleWorkspaceJwt } from "@/lib/google-workspace-auth";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export type CalendarDriveAttachment = {
  fileUrl: string;
  title: string;
  mimeType: string;
};

function getDriveClient() {
  const auth = getGoogleWorkspaceJwt([DRIVE_FILE_SCOPE]);
  return google.drive({ version: "v3", auth });
}

/**
 * Uploads a file to the organizer's Drive and returns metadata for Google Calendar event attachments.
 * The file is shared as "anyone with the link can view" so invitees can open calendar attachments.
 */
export async function uploadFileForCalendarAttachment(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<CalendarDriveAttachment> {
  const drive = getDriveClient();

  const created = await drive.files.create({
    requestBody: { name: fileName.slice(0, 240) },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, name, mimeType",
  });

  const fileId = created.data.id;
  if (!fileId) throw new Error("Google Drive did not return a file id.");

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    fileUrl: `https://drive.google.com/file/d/${fileId}/view`,
    title: created.data.name ?? fileName,
    mimeType: created.data.mimeType ?? mimeType,
  };
}

function getDriveReadonlyClient() {
  const auth = getGoogleWorkspaceJwt([DRIVE_READONLY_SCOPE]);
  return google.drive({ version: "v3", auth });
}

/** Export a Google Doc (e.g. Meet transcript) as plain text. */
export async function exportGoogleDocPlainText(documentId: string): Promise<string | null> {
  const drive = getDriveReadonlyClient();
  const res = await drive.files.export(
    { fileId: documentId, mimeType: "text/plain" },
    { responseType: "text" },
  );
  const data = res.data;
  if (typeof data === "string" && data.trim()) return data.trim();
  return null;
}
