import { jobSkillKeywords } from "@/lib/hiring-application-display";

export interface ResumeSkillMatch {
  /** 0-100: share of the job's required skills found in the résumé text. */
  score: number;
  matched: string[];
  missing: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordBoundaryTest(phrase: string, lowerText: string): boolean {
  const trimmed = phrase.trim().toLowerCase();
  if (!trimmed) return false;
  return new RegExp(`\\b${escapeRegExp(trimmed)}\\b`).test(lowerText);
}

const STOPWORDS = new Set([
  "and",
  "or",
  "the",
  "a",
  "an",
  "for",
  "with",
  "of",
  "in",
  "on",
  "to",
  "&",
]);

/**
 * Checks whether a required skill/keyword phrase is genuinely present in a résumé's raw text.
 * Deliberately lenient (ATS-style): a required skill counts as matched when the exact phrase
 * appears, or when every meaningful word in it shows up somewhere in the text (even out of
 * order) — e.g. "Client communication" matches "communicated with clients daily".
 */
function skillAppearsInText(skill: string, lowerText: string): boolean {
  if (wordBoundaryTest(skill, lowerText)) return true;

  const words = skill
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
  if (words.length === 0) return false;
  return words.every((word) => wordBoundaryTest(word, lowerText));
}

/**
 * ATS-style score: checks each keyword/phrase from the job's free-text "skills required" field
 * directly against the candidate's résumé text. No curated skill dictionary is required — this
 * works for any job, in any wording, since HOS hiring spans many role types.
 */
export function computeResumeSkillMatch(
  resumeText: string | null | undefined,
  skillsRequired: string | null | undefined,
): ResumeSkillMatch {
  const jobSkills = jobSkillKeywords(skillsRequired);
  if (jobSkills.length === 0) {
    return { score: 0, matched: [], missing: [] };
  }
  const text = (resumeText ?? "").trim();
  if (!text) {
    return { score: 0, matched: [], missing: [...jobSkills] };
  }

  const lowerText = text.toLowerCase();
  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of jobSkills) {
    if (skillAppearsInText(skill, lowerText)) matched.push(skill);
    else missing.push(skill);
  }

  const score = Math.round((matched.length / jobSkills.length) * 100);
  return { score, matched, missing };
}

export function parseSkillsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
