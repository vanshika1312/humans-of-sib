/** Max length for `HiringJob.externalApplyUrl` in the database (`VarChar(2048)`). */
export const EXTERNAL_APPLY_URL_MAX = 2048;

/**
 * Validates and normalizes a candidate-facing apply URL (http/https only).
 * @returns trimmed absolute URL string, null if empty, or `"INVALID"`.
 */
export function normalizeExternalApplyUrl(raw: unknown): string | null | "INVALID" {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return "INVALID";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "INVALID";
  const href = u.href;
  if (href.length > EXTERNAL_APPLY_URL_MAX) return "INVALID";
  return href;
}
