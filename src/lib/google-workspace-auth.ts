import { google } from "googleapis";
import { getGoogleServiceAccountCredentials } from "@/lib/google-service-account";

export function getGoogleWorkspaceOrganizerEmail(): string | null {
  const organizer = process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL?.trim();
  return organizer || null;
}

export function googleWorkspaceConfigured(): boolean {
  return getGoogleServiceAccountCredentials() !== null && Boolean(getGoogleWorkspaceOrganizerEmail());
}

export function googleApiErrorMessage(err: unknown): string {
  if (!err || typeof err !== "object") return "Google API error.";
  const e = err as {
    message?: string;
    response?: { data?: { error?: { message?: string } } };
  };
  const fromBody = e.response?.data?.error?.message?.trim();
  if (fromBody) return fromBody;
  if (typeof e.message === "string" && e.message.trim()) return e.message.trim();
  return "Google API error.";
}

/** JWT impersonating the workspace organizer (domain-wide delegation). */
export function getGoogleWorkspaceJwt(scopes: string[]) {
  const creds = getGoogleServiceAccountCredentials();
  const subject = getGoogleWorkspaceOrganizerEmail();
  if (!creds || !subject) {
    throw new Error(
      "Google Workspace integration is not configured. Set GOOGLE_SERVICE_ACCOUNT_* and GOOGLE_CALENDAR_ORGANIZER_EMAIL.",
    );
  }

  return new google.auth.JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes,
    subject,
  });
}
