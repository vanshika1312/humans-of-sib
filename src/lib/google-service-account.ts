export type GoogleServiceAccountCredentials = {
  clientEmail: string;
  privateKey: string;
};

/**
 * Service account credentials from env (same pattern as google-sheets.ts).
 *
 * OPTION A — split vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64
 *
 * OPTION B — full JSON:
 *   GOOGLE_SERVICE_ACCOUNT_JSON
 */
export function getGoogleServiceAccountCredentials(): GoogleServiceAccountCredentials | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64;

  if (email && keyB64) {
    return {
      clientEmail: email,
      privateKey: Buffer.from(keyB64, "base64").toString("utf8"),
    };
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;

  try {
    const creds = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!creds.client_email || !creds.private_key) return null;
    return {
      clientEmail: creds.client_email,
      privateKey: creds.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

export function googleServiceAccountConfigured(): boolean {
  return getGoogleServiceAccountCredentials() !== null;
}
