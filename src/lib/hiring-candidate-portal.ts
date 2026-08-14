/** Source tag for applications created via the public careers portal. */
export const SELF_SIGNUP_SOURCE = "self_signup" as const;

export const SELF_SIGNUP_LABEL = "Self signup (careers)";

export function isSelfSignupSource(
  applicationSource: string | null | undefined,
  candidateSource?: string | null | undefined,
): boolean {
  const a = applicationSource?.trim().toLowerCase();
  if (a === SELF_SIGNUP_SOURCE) return true;
  const c = candidateSource?.trim().toLowerCase();
  return c === SELF_SIGNUP_SOURCE;
}

export type CandidateEducationEntry = {
  school: string;
  degree?: string;
  year?: string;
};

export type CandidateWorkHistoryEntry = {
  company: string;
  title?: string;
  start?: string;
  end?: string;
  description?: string;
};

export function parseEducationJson(raw: unknown): CandidateEducationEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CandidateEducationEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const school = typeof o.school === "string" ? o.school.trim() : "";
    if (!school) continue;
    out.push({
      school,
      degree: typeof o.degree === "string" ? o.degree.trim() || undefined : undefined,
      year: typeof o.year === "string" ? o.year.trim() || undefined : undefined,
    });
  }
  return out;
}

export function parseWorkHistoryJson(raw: unknown): CandidateWorkHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CandidateWorkHistoryEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const company = typeof o.company === "string" ? o.company.trim() : "";
    if (!company) continue;
    out.push({
      company,
      title: typeof o.title === "string" ? o.title.trim() || undefined : undefined,
      start: typeof o.start === "string" ? o.start.trim() || undefined : undefined,
      end: typeof o.end === "string" ? o.end.trim() || undefined : undefined,
      description:
        typeof o.description === "string" ? o.description.trim() || undefined : undefined,
    });
  }
  return out;
}
