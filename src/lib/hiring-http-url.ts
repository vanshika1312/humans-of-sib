/** Max length matching `HiringCandidate.portfolioUrl` (`VarChar(2048)`). */
export const PORTFOLIO_URL_MAX = 2048;

/**
 * Optional http(s) URL. Empty → null. Bare domains get `https://` prepended.
 */
export function normalizeOptionalHttpUrl(raw: unknown): string | null | "INVALID" {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return null;
  let candidate = s;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return "INVALID";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "INVALID";
  if (u.href.length > PORTFOLIO_URL_MAX) return "INVALID";
  return u.href;
}

export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
