import type { HiringJobQuestionInput } from "@/lib/hiring-job-questions";

export const LIKERT_OPTIONS = [
  { value: "1", label: "Strongly disagree" },
  { value: "2", label: "Disagree" },
  { value: "3", label: "Neutral" },
  { value: "4", label: "Agree" },
  { value: "5", label: "Strongly agree" },
] as const;

/** Big Five personality traits scored on the psychometric stage. Work style is left to DISC later. */
export type PersonalityDimension =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "emotionalStability";

export type PsychometricDimension = PersonalityDimension;

export const PERSONALITY_DIMENSION_LABEL: Record<PersonalityDimension, string> = {
  openness: "Openness",
  conscientiousness: "Conscientiousness",
  extraversion: "Extraversion",
  agreeableness: "Agreeableness",
  emotionalStability: "Emotional stability",
};

/** Older work-style keys still stored on assessments submitted before the personality inventory. */
const LEGACY_WORK_STYLE_DIMENSION_LABEL: Record<string, string> = {
  learnerFirst: "Learner-first",
  grit: "Grit in the field",
  collaboration: "Collaboration",
  integrity: "Integrity",
  adaptability: "Adaptability",
};

export const PSYCHOMETRIC_DIMENSION_LABEL: Record<string, string> = {
  ...PERSONALITY_DIMENSION_LABEL,
  ...LEGACY_WORK_STYLE_DIMENSION_LABEL,
};

export type AssessmentQuestionType = "LIKERT" | "SITUATIONAL" | "LONG_TEXT";
export type AssessmentQuestionKind = "PSYCHOMETRIC" | "ROLE";

export type AssessmentOption = {
  value: string;
  label: string;
  /** 1–5 contribution when this option is chosen (situational items). */
  score?: number;
};

export type AssessmentQuestion = {
  key: string;
  kind: AssessmentQuestionKind;
  type: AssessmentQuestionType;
  prompt: string;
  helpText?: string;
  dimension?: PersonalityDimension;
  reverse?: boolean;
  options?: AssessmentOption[];
};

export type AssessmentResponse = AssessmentQuestion & {
  answer: string;
};

export type RoleFamily =
  | "sales"
  | "marketing"
  | "social-media"
  | "product"
  | "hr"
  | "supply-chain"
  | "operations"
  | "finance"
  | "accounts"
  | "video-editing"
  | "csat"
  | "tech"
  | "founders-office"
  | "general";

export const ROLE_FAMILY_LABEL: Record<RoleFamily, string> = {
  sales: "Sales",
  marketing: "Marketing",
  "social-media": "Social Media",
  product: "Product",
  hr: "HR",
  "supply-chain": "Supply Chain",
  operations: "Operations",
  finance: "Finance",
  accounts: "Accounts",
  "video-editing": "Video Editing",
  csat: "CSAT",
  tech: "Tech",
  "founders-office": "Founders' Office",
  general: "Skillinabox",
};

/**
 * Generic Big Five screen (two Likert items per trait, one reverse-scored).
 * Intentionally not work-style — DISC in a later round covers how they operate on the job.
 */
export const PSYCHOMETRIC_QUESTIONS: AssessmentQuestion[] = [
  {
    key: "psych.openness.plus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "openness",
    prompt: "I enjoy exploring unfamiliar ideas even when they have no immediate practical use.",
  },
  {
    key: "psych.conscientiousness.plus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "conscientiousness",
    prompt: "I finish what I start, even after the interesting part is over.",
  },
  {
    key: "psych.extraversion.minus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "extraversion",
    reverse: true,
    prompt: "A quiet evening on my own usually sounds better than a lively group.",
  },
  {
    key: "psych.agreeableness.plus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "agreeableness",
    prompt: "I assume people mean well unless I have a clear reason not to.",
  },
  {
    key: "psych.emotionalStability.minus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "emotionalStability",
    reverse: true,
    prompt: "Small problems tend to stay on my mind longer than they should.",
  },
  {
    key: "psych.openness.minus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "openness",
    reverse: true,
    prompt: "I prefer sticking with what I already know rather than trying something untested.",
  },
  {
    key: "psych.conscientiousness.minus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "conscientiousness",
    reverse: true,
    prompt: "I tend to leave details and follow-through until the last possible moment.",
  },
  {
    key: "psych.extraversion.plus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "extraversion",
    prompt: "Being around people for a stretch of time leaves me more energized than drained.",
  },
  {
    key: "psych.agreeableness.minus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "agreeableness",
    reverse: true,
    prompt: "When someone disagrees with me, my first instinct is to hold my ground rather than look for common ground.",
  },
  {
    key: "psych.emotionalStability.plus",
    kind: "PSYCHOMETRIC",
    type: "LIKERT",
    dimension: "emotionalStability",
    prompt: "I stay even-keeled when plans change or things go wrong.",
  },
];

type RolePrompt = { key: string; prompt: string; helpText?: string };

const ROLE_QUESTION_BANK: Record<RoleFamily, RolePrompt[]> = {
  sales: [
    {
      key: "role.sales.doorstep",
      prompt:
        "How would you explain Skillinabox’s doorstep skilling model to a woman who has never enrolled in a training program — in language she would actually use?",
      helpText: "We sell a learning journey, not a product brochure. Think trust, family, time, and what she gains.",
    },
    {
      key: "role.sales.recovery",
      prompt:
        "Walk through how you would recover a week where conversions are down in your territory. What would you look at first, and what would you change on the ground?",
    },
  ],
  marketing: [
    {
      key: "role.marketing.trust",
      prompt:
        "How would you position doorstep skilling for women who do not trust online ads or “too good to be true” training offers?",
    },
    {
      key: "role.marketing.enroll",
      prompt:
        "Describe a campaign you would run to recruit learners in a new city. How would you know it moved enrollments, not just reach?",
    },
  ],
  "social-media": [
    {
      key: "role.social.real",
      prompt:
        "What content would you create so last-mile skilling feels real — not like a corporate ad? Name the format, the voice, and who it is for.",
    },
    {
      key: "role.social.crisis",
      prompt:
        "A learner posts publicly that they had a poor experience. What do you do in the first hour, and what do you not do?",
    },
  ],
  product: [
    {
      key: "role.product.dropout",
      prompt:
        "A trainer says learners drop off after module 2. How would you diagnose the problem, and what would you ship first?",
    },
    {
      key: "role.product.bharat",
      prompt:
        "How would you design a feature for users with low digital literacy and intermittent connectivity? What would you refuse to add?",
    },
  ],
  hr: [
    {
      key: "role.hr.screen",
      prompt:
        "How would you screen for people who can thrive in field-heavy, learner-first work — not just a strong résumé?",
    },
    {
      key: "role.hr.thirty",
      prompt:
        "A new joiner is struggling with Skillinabox’s pace in week two. How do you intervene in the first 30 days without lowering the bar?",
    },
  ],
  "supply-chain": [
    {
      key: "role.supply.kits",
      prompt:
        "How would you make sure training kits reach a remote batch on time when last-mile partners and HQ are both in the loop?",
    },
    {
      key: "role.supply.miss",
      prompt:
        "A vendor misses a delivery the day before a session. What is your playbook for the next six hours?",
    },
  ],
  operations: [
    {
      key: "role.ops.batch",
      prompt:
        "How would you coordinate trainers, venues, and learner batches across multiple cities in one week without quality slipping?",
    },
    {
      key: "role.ops.noshow",
      prompt:
        "A trainer no-shows two hours before a doorstep session. What do you do next, and how do you protect the learner’s time?",
    },
  ],
  finance: [
    {
      key: "role.finance.spend",
      prompt:
        "How would you track program spend when costs sit with both field partners and HQ — without slowing the field to a halt?",
    },
    {
      key: "role.finance.claim",
      prompt:
        "A reimbursement claim looks inflated. What is your process from the moment you notice to the moment it is resolved?",
    },
  ],
  accounts: [
    {
      key: "role.accounts.docs",
      prompt:
        "How would you keep invoices, reimbursements, and partner payouts accurate when activity is happening in many cities at once?",
    },
    {
      key: "role.accounts.control",
      prompt:
        "What controls would you put in place so field teams can move fast without creating messy books?",
    },
  ],
  "video-editing": [
    {
      key: "role.video.journey",
      prompt:
        "How would you cut a 90-second film of a learner’s journey that feels respectful — not extractive or overly polished?",
    },
    {
      key: "role.video.phone",
      prompt:
        "What does a good training video look like for someone watching on a low-end phone with patchy data? What would you cut?",
    },
  ],
  csat: [
    {
      key: "role.csat.miss",
      prompt:
        "A learner says they enrolled but never got a trainer visit. How do you resolve it, and what do you change so it does not repeat?",
    },
    {
      key: "role.csat.loop",
      prompt:
        "How would you use CSAT data to change how field teams work — not just report a score at the end of the month?",
    },
  ],
  tech: [
    {
      key: "role.tech.offline",
      prompt:
        "How would you design an internal tool for field staff with patchy connectivity? What breaks first, and how do you design around it?",
    },
    {
      key: "role.tech.messy",
      prompt:
        "HR or ops asks for a feature that would create messy data. How do you push back, and what would you ship instead?",
    },
  ],
  "founders-office": [
    {
      key: "role.fo.drop",
      prompt:
        "A founder asks you to figure out why conversions dropped in one state. How do you structure the first week?",
    },
    {
      key: "role.fo.no",
      prompt:
        "How do you say no to a request that would distract from learner outcomes — without becoming a bottleneck?",
    },
  ],
  general: [
    {
      key: "role.general.why",
      prompt:
        "Why Skillinabox? What about doorstep skilling for women across India makes this the place you want to do the work?",
    },
    {
      key: "role.general.access",
      prompt:
        "Describe a time you worked with people who had less access to opportunity than you. What did you change about how you showed up?",
    },
  ],
};

const TITLE_FAMILY_RULES: { includes: string; family: RoleFamily }[] = [
  { includes: "sales", family: "sales" },
  { includes: "business development", family: "sales" },
  { includes: "bd ", family: "sales" },
  { includes: "telecaller", family: "sales" },
  { includes: "marketing", family: "marketing" },
  { includes: "brand", family: "marketing" },
  { includes: "growth", family: "marketing" },
  { includes: "social", family: "social-media" },
  { includes: "content creator", family: "social-media" },
  { includes: "product", family: "product" },
  { includes: "ux", family: "product" },
  { includes: "recruiter", family: "hr" },
  { includes: "talent", family: "hr" },
  { includes: "people", family: "hr" },
  { includes: "human resource", family: "hr" },
  { includes: "supply", family: "supply-chain" },
  { includes: "logistics", family: "supply-chain" },
  { includes: "warehouse", family: "supply-chain" },
  { includes: "procurement", family: "supply-chain" },
  { includes: "operation", family: "operations" },
  { includes: "program", family: "operations" },
  { includes: "trainer", family: "operations" },
  { includes: "coordinator", family: "operations" },
  { includes: "finance", family: "finance" },
  { includes: "account", family: "accounts" },
  { includes: "video", family: "video-editing" },
  { includes: "editor", family: "video-editing" },
  { includes: "motion", family: "video-editing" },
  { includes: "csat", family: "csat" },
  { includes: "customer success", family: "csat" },
  { includes: "support", family: "csat" },
  { includes: "engineer", family: "tech" },
  { includes: "developer", family: "tech" },
  { includes: "software", family: "tech" },
  { includes: "sde", family: "tech" },
  { includes: "frontend", family: "tech" },
  { includes: "backend", family: "tech" },
  { includes: "full stack", family: "tech" },
  { includes: "chief of staff", family: "founders-office" },
  { includes: "founder", family: "founders-office" },
  { includes: "strategy", family: "founders-office" },
];

const DEPARTMENT_TO_FAMILY: Record<string, RoleFamily> = {
  sales: "sales",
  marketing: "marketing",
  "social-media": "social-media",
  product: "product",
  hr: "hr",
  "supply-chain": "supply-chain",
  operations: "operations",
  finance: "finance",
  accounts: "accounts",
  "video-editing": "video-editing",
  csat: "csat",
  tech: "tech",
  "founders-office": "founders-office",
};

function slugifyLoose(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function roleFamilyFromJob(title: string, departmentName: string | null | undefined): RoleFamily {
  const deptSlug = departmentName ? slugifyLoose(departmentName) : "";
  if (deptSlug && DEPARTMENT_TO_FAMILY[deptSlug]) return DEPARTMENT_TO_FAMILY[deptSlug];

  const hay = `${title} ${departmentName ?? ""}`.toLowerCase();
  for (const rule of TITLE_FAMILY_RULES) {
    if (hay.includes(rule.includes)) return rule.family;
  }
  return "general";
}

function thirtyDayQuestion(title: string): AssessmentQuestion {
  const role = title.trim() || "this role";
  return {
    key: "role.thirtyDays",
    kind: "ROLE",
    type: "LONG_TEXT",
    prompt: `This opening is ${role}. What would you own in your first 30 days, and what would you need from the team to do it well?`,
    helpText: "Be concrete — activities, people, and what “good” looks like by day 30.",
  };
}

export function roleQuestionsForJob(title: string, departmentName: string | null | undefined): AssessmentQuestion[] {
  const family = roleFamilyFromJob(title, departmentName);
  const bank = ROLE_QUESTION_BANK[family] ?? ROLE_QUESTION_BANK.general;
  return [
    ...bank.slice(0, 2).map((q) => ({
      key: q.key,
      kind: "ROLE" as const,
      type: "LONG_TEXT" as const,
      prompt: q.prompt,
      helpText: q.helpText,
    })),
    thirtyDayQuestion(title),
  ];
}

export function buildAssessmentQuestions(job: {
  title: string;
  departmentName?: string | null;
}): AssessmentQuestion[] {
  return [...PSYCHOMETRIC_QUESTIONS, ...roleQuestionsForJob(job.title, job.departmentName)];
}

export function publicAssessmentQuestions(questions: AssessmentQuestion[]): AssessmentQuestion[] {
  return questions.map((q) => ({
    ...q,
    reverse: undefined,
    options: q.options?.map(({ value, label }) => ({ value, label })),
  }));
}

function likertScore(raw: string, reverse?: boolean): number | null {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return reverse ? 6 - n : n;
}

export function scorePsychometricDimensions(
  questions: AssessmentQuestion[],
  answers: Record<string, string>,
): Record<PersonalityDimension, number> {
  const buckets: Record<PersonalityDimension, number[]> = {
    openness: [],
    conscientiousness: [],
    extraversion: [],
    agreeableness: [],
    emotionalStability: [],
  };

  for (const q of questions) {
    if (q.kind !== "PSYCHOMETRIC" || !q.dimension) continue;
    const raw = answers[q.key]?.trim() ?? "";
    if (!raw) continue;

    if (q.type === "LIKERT") {
      const score = likertScore(raw, q.reverse);
      if (score != null) buckets[q.dimension].push(score);
      continue;
    }

    if (q.type === "SITUATIONAL") {
      const opt = q.options?.find((o) => o.value === raw);
      if (opt && typeof opt.score === "number") buckets[q.dimension].push(opt.score);
    }
  }

  const out = {} as Record<PersonalityDimension, number>;
  for (const dim of Object.keys(buckets) as PersonalityDimension[]) {
    const vals = buckets[dim];
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    out[dim] = Math.round(avg * 10) / 10;
  }
  return out;
}

export function validateAssessmentAnswers(
  questions: AssessmentQuestion[],
  answers: Record<string, string>,
): { error: string | null; responses: AssessmentResponse[] } {
  const responses: AssessmentResponse[] = [];

  for (const q of questions) {
    const raw = (answers[q.key] ?? "").trim();
    if (!raw) {
      return { error: `Please answer “${q.prompt}”.`, responses: [] };
    }

    if (q.type === "LIKERT") {
      if (!LIKERT_OPTIONS.some((o) => o.value === raw)) {
        return { error: `Pick a valid rating for “${q.prompt}”.`, responses: [] };
      }
    } else if (q.type === "SITUATIONAL") {
      const allowed = (q.options ?? []).map((o) => o.value);
      if (!allowed.includes(raw)) {
        return { error: `Pick a valid option for “${q.prompt}”.`, responses: [] };
      }
    } else if (raw.length > 8000) {
      return { error: `“${q.prompt}” is too long.`, responses: [] };
    } else if (raw.length < 40) {
      return { error: `Give a bit more detail for “${q.prompt}” (at least a few sentences).`, responses: [] };
    }

    responses.push({ ...q, answer: raw });
  }

  return { error: null, responses };
}

export function collectAssessmentAnswersFromForm(
  formData: FormData,
  questions: AssessmentQuestion[],
): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of questions) {
    answers[q.key] = String(formData.get(`aq_${q.key}`) ?? "");
  }
  return answers;
}

export function responsesToJson(responses: AssessmentResponse[]) {
  return responses.map((r) => ({
    key: r.key,
    kind: r.kind,
    type: r.type,
    prompt: r.prompt,
    helpText: r.helpText ?? null,
    dimension: r.dimension ?? null,
    answer: r.answer,
    options: r.options?.map((o) => ({ value: o.value, label: o.label })) ?? null,
  }));
}

export type StoredAssessmentResponse = {
  key: string;
  kind: AssessmentQuestionKind;
  type: AssessmentQuestionType;
  prompt: string;
  helpText: string | null;
  dimension: string | null;
  answer: string;
  options: { value: string; label: string }[] | null;
};

export function parseStoredResponses(raw: unknown): StoredAssessmentResponse[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredAssessmentResponse[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.prompt !== "string" || typeof o.answer !== "string") continue;
    const type = o.type === "LIKERT" || o.type === "SITUATIONAL" || o.type === "LONG_TEXT" ? o.type : "LONG_TEXT";
    const kind = o.kind === "PSYCHOMETRIC" || o.kind === "ROLE" ? o.kind : "ROLE";
    const dim =
      typeof o.dimension === "string" && o.dimension in PSYCHOMETRIC_DIMENSION_LABEL ? o.dimension : null;
    const options = Array.isArray(o.options)
      ? o.options
          .filter((opt): opt is { value: string; label: string } => {
            return Boolean(opt && typeof opt === "object" && "value" in opt && "label" in opt);
          })
          .map((opt) => ({ value: String(opt.value), label: String(opt.label) }))
      : null;
    out.push({
      key: typeof o.key === "string" ? o.key : "",
      kind,
      type,
      prompt: o.prompt,
      helpText: typeof o.helpText === "string" ? o.helpText : null,
      dimension: dim,
      answer: o.answer,
      options,
    });
  }
  return out;
}

export function parseDimensionScores(raw: unknown): Partial<Record<string, number>> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<string, number>> = {};
  for (const dim of Object.keys(PSYCHOMETRIC_DIMENSION_LABEL)) {
    const n = o[dim];
    if (typeof n === "number" && Number.isFinite(n)) out[dim] = n;
  }
  return out;
}

export function listDimensionScoreRows(scores: Partial<Record<string, number>>): {
  source: "personality" | "workStyle";
  rows: { key: string; label: string; value: number }[];
} {
  const personality = (Object.keys(PERSONALITY_DIMENSION_LABEL) as PersonalityDimension[])
    .filter((d) => typeof scores[d] === "number")
    .map((d) => ({ key: d, label: PERSONALITY_DIMENSION_LABEL[d], value: scores[d]! }));
  if (personality.length) return { source: "personality", rows: personality };

  return {
    source: "workStyle",
    rows: Object.entries(LEGACY_WORK_STYLE_DIMENSION_LABEL)
      .filter(([key]) => typeof scores[key] === "number")
      .map(([key, label]) => ({ key, label, value: scores[key]! })),
  };
}

export function displayAnswerLabel(row: StoredAssessmentResponse): string {
  if (row.type === "LIKERT") {
    return LIKERT_OPTIONS.find((o) => o.value === row.answer)?.label ?? row.answer;
  }
  if (row.type === "SITUATIONAL") {
    return row.options?.find((o) => o.value === row.answer)?.label ?? row.answer;
  }
  return row.answer;
}

/** Apply-form extras recruiters can one-click add — complementary to the personality + role assessment. */
export function suggestedApplyQuestionsForJob(
  title: string,
  departmentName: string | null | undefined,
): HiringJobQuestionInput[] {
  const family = roleFamilyFromJob(title, departmentName);
  const role = title.trim() || "this role";
  const common: HiringJobQuestionInput[] = [
    {
      prompt: "Why do you want this role at Skillinabox?",
      helpText: "A few sentences on the work, the learners, or the team — not a generic cover letter.",
      type: "LONG_TEXT",
      required: true,
      options: [],
    },
    {
      prompt: "When can you join if selected?",
      type: "DROPDOWN",
      required: true,
      options: ["Immediately", "15 days", "30 days", "60 days", "90 days or more"],
    },
  ];

  const fieldHeavy: RoleFamily[] = ["sales", "operations", "supply-chain", "csat"];
  if (fieldHeavy.includes(family)) {
    common.push({
      prompt: "This role involves field / community work. Are you willing to travel as the job requires?",
      type: "YES_NO",
      required: true,
      options: [],
    });
  } else {
    common.push({
      prompt: `What part of ${role} do you already do well, and where would you need the most support in the first 90 days?`,
      type: "LONG_TEXT",
      required: true,
      options: [],
    });
  }

  return common;
}

export function assessmentEligible(stage: {
  key: string;
  isHired: boolean;
  isRejected: boolean;
}): boolean {
  if (stage.isHired || stage.isRejected) return false;
  if (stage.key === "WITHDRAWN") return false;
  return true;
}
