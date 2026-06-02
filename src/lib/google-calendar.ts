import { google } from "googleapis";
import type { CalendarDriveAttachment } from "@/lib/google-drive";
import { getGoogleWorkspaceJwt, googleWorkspaceConfigured } from "@/lib/google-workspace-auth";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

export type CreateInterviewCalendarEventInput = {
  title: string;
  description?: string | null;
  locationOrLink?: string | null;
  scheduledAt: Date;
  durationMinutes: number;
  timezone: string;
  attendeeEmails: string[];
  attachments?: CalendarDriveAttachment[];
};

export type CreateInterviewCalendarEventResult = {
  eventId: string;
  htmlLink: string | null;
};

function getCalendarClient() {
  const auth = getGoogleWorkspaceJwt([CALENDAR_SCOPE]);
  return google.calendar({ version: "v3", auth });
}

function toCalendarDateTime(isoUtc: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(isoUtc);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

export function googleCalendarConfigured(): boolean {
  return googleWorkspaceConfigured();
}

/**
 * Creates a calendar event on the organizer's primary calendar and emails invites to all attendees.
 */
export async function createInterviewCalendarEvent(
  input: CreateInterviewCalendarEventInput,
): Promise<CreateInterviewCalendarEventResult> {
  const calendar = getCalendarClient();
  const endAt = new Date(input.scheduledAt.getTime() + input.durationMinutes * 60_000);

  const attendees = [...new Set(input.attendeeEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))].map(
    (email) => ({ email }),
  );

  if (attendees.length === 0) {
    throw new Error("At least one attendee email is required.");
  }

  const timeZone = input.timezone.trim() || "Asia/Kolkata";
  const start = toCalendarDateTime(input.scheduledAt, timeZone);
  const end = toCalendarDateTime(endAt, timeZone);

  const attachments = (input.attachments ?? []).slice(0, 10);

  const res = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 0,
    sendUpdates: "all",
    supportsAttachments: attachments.length > 0,
    requestBody: {
      summary: input.title.slice(0, 280),
      description: input.description?.trim() || undefined,
      location: input.locationOrLink?.trim() || undefined,
      start: { dateTime: start, timeZone },
      end: { dateTime: end, timeZone },
      attendees,
      attachments: attachments.length
        ? attachments.map((a) => ({
            fileUrl: a.fileUrl,
            title: a.title.slice(0, 280),
            mimeType: a.mimeType,
          }))
        : undefined,
      reminders: {
        useDefault: true,
      },
    },
  });

  const eventId = res.data.id;
  if (!eventId) throw new Error("Google Calendar did not return an event id.");

  return {
    eventId,
    htmlLink: res.data.htmlLink ?? null,
  };
}
