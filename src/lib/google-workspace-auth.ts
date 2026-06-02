import { google } from "googleapis";
import { getGoogleServiceAccountCredentials } from "@/lib/google-service-account";

export function getGoogleWorkspaceOrganizerEmail(): string | null {
  const organizer = process.env.GOOGLE_CALENDAR_ORGANIZER_EMAIL?.trim();
  return organizer || null;
}

export function googleWorkspaceConfigured(): boolean {
  return getGoogleServiceAccountCredentials() !== null && Boolean(getGoogleWorkspaceOrganizerEmail());
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
