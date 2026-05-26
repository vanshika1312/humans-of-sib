import { isBulkImportStoredResumeUrl } from "@/lib/hiring-resume-upload";

/** Accepts https URLs or same-origin paths (e.g. `/hiring-uploads/…` from local storage). */
export function normalizeLiaDetailUrl(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v.slice(0, 2048);
  if (v.startsWith("/") && !/\s/.test(v)) return v.slice(0, 2048);
  return undefined;
}

export function isLiaStoredPolicyFileUrl(url: string | null | undefined): boolean {
  return isBulkImportStoredResumeUrl(url);
}
