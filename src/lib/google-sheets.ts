import { google } from "googleapis";

/**
 * Parse a Google Sheets URL and extract the spreadsheet ID.
 *
 * Supports formats like:
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/pub
 */
export function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

/**
 * Build a Google Sheets API client authenticated as the service account.
 *
 * Requires GOOGLE_SERVICE_ACCOUNT_JSON to be set in env — paste the full
 * contents of the service-account JSON key file downloaded from Google Cloud.
 */
function getSheetsClient() {
  // Support two ways to provide credentials:
  //
  // OPTION A (recommended) — split vars, base64 private key:
  //   GOOGLE_SERVICE_ACCOUNT_EMAIL=my-sa@project.iam.gserviceaccount.com
  //   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64=<base64-encoded PEM key>
  //
  //   To get the base64 key from your downloaded JSON file, run:
  //   node -e "const k=require('./service-account.json').private_key; console.log(Buffer.from(k).toString('base64'))"
  //
  // OPTION B — full JSON blob (works if newlines are preserved correctly):
  //   GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

  let clientEmail: string;
  let privateKey: string;

  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64;

  if (email && keyB64) {
    // OPTION A — decode base64 → real PEM (newlines always correct)
    clientEmail = email;
    privateKey  = Buffer.from(keyB64, "base64").toString("utf8");
  } else {
    // OPTION B — full JSON blob
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      throw new Error(
        "Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64, " +
        "or GOOGLE_SERVICE_ACCOUNT_JSON.",
      );
    }
    const creds = JSON.parse(raw);
    clientEmail = creds.client_email;
    // Unescape \\n → real newline in case the var was double-encoded
    privateKey  = (creds.private_key as string).replace(/\\n/g, "\n");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

/**
 * Fetch all rows from a Google Sheet and return them as an array of objects,
 * keyed by the header row (lowercased, spaces → underscores).
 *
 * This returns the same shape as PapaParse with `header: true`, so the
 * existing bulkRowSchema can validate each row without any transformation.
 *
 * @param sheetUrl  Full URL of the Google Sheet
 * @param range     A1 notation range to read (default: entire first sheet)
 */
export async function fetchSheetRows(
  sheetUrl: string,
  range = "A:Z",
): Promise<Record<string, string>[]> {
  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  if (!spreadsheetId) throw new Error(`Cannot extract spreadsheet ID from URL: ${sheetUrl}`);

  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rawRows = res.data.values ?? [];
  if (rawRows.length < 2) return []; // no data rows (header only or empty)

  // Normalise header row: trim, lowercase, spaces → underscores
  const headers = rawRows[0].map((h: string) =>
    String(h).trim().toLowerCase().replace(/\s+/g, "_"),
  );

  return rawRows.slice(1).map((row: string[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, i: number) => {
      obj[header] = String(row[i] ?? "").trim();
    });
    return obj;
  });
}
