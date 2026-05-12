import type { HiringJobWorkArrangement } from "@/generated/prisma";
import { WORK_ARRANGEMENT_LABEL } from "@/lib/hiring-job-copy";

export function splitCandidateFullName(fullName: string): { firstName: string; lastName: string } {
  const t = fullName.trim();
  if (!t) return { firstName: "—", lastName: "—" };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "—" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export function formatHiringJobLocation(job: {
  workArrangement: HiringJobWorkArrangement | null;
  location: string | null;
}): string {
  const bits = [
    job.workArrangement ? WORK_ARRANGEMENT_LABEL[job.workArrangement] : null,
    job.location?.trim() ? job.location.trim() : null,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "—";
}

export function applicationSourceLabel(
  applicationSource: string | null | undefined,
  candidateSource: string | null | undefined,
): string {
  const a = applicationSource?.trim();
  if (a) return a;
  const c = candidateSource?.trim();
  if (c) return c;
  return "—";
}

/** Keywords from a job description's "skills required" field for tag-style display. */
export function jobSkillKeywords(skillsRequired: string | null | undefined): string[] {
  if (!skillsRequired?.trim()) return [];
  const parts = skillsRequired
    .split(/[\n,;•|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)].slice(0, 24);
}
