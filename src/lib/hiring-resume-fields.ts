/**
 * Rule-based résumé field extraction (HiringPlatform-style): regex + heuristics only.
 * No external AI/API — free, deterministic, and aligned with SkillInABox HiringPlatform.
 */

export type ParsedResumeFields = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  candidateLocation: string | null;
  /** Kept for stored payload compatibility; always empty under rule-based parsing. */
  fieldConfidence: Record<string, number | undefined>;
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
// Indian mobile numbers, with or without country code, and with or without a
// single space/hyphen separator (e.g. "+91 98200 11234", "9820011234").
const PHONE_REGEX = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/;
// Explicit "Address: ..." / "Location: ..." style lines, common near the top
// of a résumé's contact block.
const LOCATION_LABEL_REGEX =
  /\b(?:address|location|based in|residing in|city)\s*[:\-]\s*([A-Za-z][A-Za-z\s,.-]{2,60})/i;
// Fallback: match against a curated list of major Indian cities/regions
// anywhere in the text (word-boundary, case-insensitive).
const KNOWN_LOCATIONS = [
  "Mumbai",
  "New Delhi",
  "Delhi",
  "Bengaluru",
  "Bangalore",
  "Pune",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
  "Chandigarh",
  "Nagpur",
  "Indore",
  "Bhopal",
  "Patna",
  "Surat",
  "Nashik",
  "Thane",
  "Vadodara",
  "Goa",
  "Kochi",
  "Coimbatore",
  "Mysuru",
  "Mysore",
  "Noida",
  "Gurugram",
  "Gurgaon",
  "Faridabad",
  "Ghaziabad",
  "Udaipur",
  "Amritsar",
  "Ludhiana",
  "Visakhapatnam",
  "Bhubaneswar",
  "Raipur",
  "Ranchi",
  "Guwahati",
];
// Lines containing these words are almost never the candidate's name, even
// if they otherwise look name-shaped (e.g. a section heading in Title Case).
const NAME_LINE_BLOCKLIST =
  /(resume|curriculum vitae|\bcv\b|address|objective|summary|profile|about\s*me|linkedin|github|portfolio|email|phone|mobile|contact|skills?|experience|education|projects?|certifications?|references?|declaration)/i;

export function sanitizeParsedResumeFields(raw: ParsedResumeFields): ParsedResumeFields {
  const trimOrNull = (s: string | null | undefined, max: number) => {
    if (s === null || s === undefined) return null;
    const v = String(s).trim();
    if (!v) return null;
    return v.slice(0, max);
  };
  const email = trimOrNull(raw.email, 320)?.toLowerCase() ?? null;
  return {
    fullName: trimOrNull(raw.fullName, 200),
    email,
    phone: trimOrNull(raw.phone, 64),
    candidateLocation: trimOrNull(raw.candidateLocation, 200),
    fieldConfidence: raw.fieldConfidence ?? {},
  };
}

function extractLocationRuleBased(text: string): string | undefined {
  const labeled = text.match(LOCATION_LABEL_REGEX)?.[1]?.trim();
  if (labeled) {
    // Keep it to a single line/segment (labels can bleed into the next field).
    return labeled.split(/[\n]/)[0].replace(/[,.\s]+$/, "").trim();
  }
  for (const city of KNOWN_LOCATIONS) {
    const pattern = new RegExp(`\\b${city.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (pattern.test(text)) return city;
  }
  return undefined;
}

function looksLikeNameLine(line: string): boolean {
  if (!line || line.length > 60) return false;
  if (EMAIL_REGEX.test(line) || PHONE_REGEX.test(line)) return false;
  if (/https?:\/\/|www\.|@/i.test(line)) return false;
  if (/\d/.test(line)) return false;
  if (NAME_LINE_BLOCKLIST.test(line)) return false;

  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;

  const wordPattern = /^[A-Za-z][A-Za-z'.-]*$/;
  if (!words.every((w) => wordPattern.test(w))) return false;

  const isTitleCase = words.every((w) => /^[A-Z][a-zA-Z'.-]*$/.test(w));
  const isAllCaps = line === line.toUpperCase();
  return isTitleCase || isAllCaps;
}

function toTitleCase(line: string): string {
  return line
    .toLowerCase()
    .replace(/(^|\s)([a-z])/g, (_match, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Rule-based name guess: a candidate's name is almost always the first
 * short, name-shaped line at the very top of the résumé, before any
 * contact details or section headings appear.
 */
function extractNameRuleBased(text: string): string | undefined {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 10)) {
    if (looksLikeNameLine(line)) {
      return line === line.toUpperCase() ? toTitleCase(line) : line;
    }
  }
  return undefined;
}

/**
 * Regex + heuristic résumé field extraction — no external AI/API calls.
 * Same approach as HiringPlatform `parseResumeText` (contact fields).
 */
export function extractResumeFieldsRuleBased(text: string): ParsedResumeFields {
  const fullName = extractNameRuleBased(text) ?? null;
  const email = text.match(EMAIL_REGEX)?.[0] ?? null;
  const phone = text.match(PHONE_REGEX)?.[0]?.replace(/\s+/g, " ").trim() ?? null;
  const candidateLocation = extractLocationRuleBased(text) ?? null;

  return sanitizeParsedResumeFields({
    fullName,
    email,
    phone,
    candidateLocation,
    fieldConfidence: {},
  });
}

export type ResolvedResumeFields = {
  parsed: ParsedResumeFields;
  source: "rule_based";
  model: null;
  warnings: string[];
};

/**
 * Resolves résumé profile fields from plain text via local heuristics only.
 */
export async function resolveResumeFields(text: string): Promise<ResolvedResumeFields> {
  return {
    parsed: extractResumeFieldsRuleBased(text),
    source: "rule_based",
    model: null,
    warnings: [],
  };
}
