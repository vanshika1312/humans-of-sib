/**
 * Maps HiringPipelineStage.key (HRMS ATS) → EOD funnel buckets.
 * Aligns with legacy RecruitmentFunnelStage slugs where possible.
 *
 * @see docs/eod/stage-metric-map.md
 */

/** EOD / legacy recruitment metric buckets */
export const EOD_METRIC_BUCKETS = [
  "applied",
  "screening",
  "round1",
  "round2",
  "final",
  "offers",
  "joined",
  "rejected",
  "dnp",
  "other",
] as const;

export type EodMetricBucket = (typeof EOD_METRIC_BUCKETS)[number];

export type StageMetricMapEntry = {
  bucket: EodMetricBucket;
  /** Optional note for admins */
  description?: string;
};

/**
 * Explicit key → bucket overrides (case-insensitive match on stage key).
 * First match wins when iterating entries; use specific keys before broad patterns.
 */
export const STAGE_KEY_TO_EOD_BUCKET: Record<string, StageMetricMapEntry> = {
  APPLIED: { bucket: "applied", description: "New / inbound applications" },
  NEW: { bucket: "applied" },

  SCREENING: { bucket: "screening" },
  SCREEN: { bucket: "screening" },
  HR_SCREEN: { bucket: "screening" },
  PHONE_SCREEN: { bucket: "screening" },

  ROUND_1: { bucket: "round1" },
  ROUND1: { bucket: "round1" },
  R1: { bucket: "round1" },
  TECH_ROUND_1: { bucket: "round1" },
  INTERVIEW_1: { bucket: "round1" },

  ROUND_2: { bucket: "round2" },
  ROUND2: { bucket: "round2" },
  R2: { bucket: "round2" },
  TECH_ROUND_2: { bucket: "round2" },
  INTERVIEW_2: { bucket: "round2" },

  FINAL: { bucket: "final" },
  FINAL_ROUND: { bucket: "final" },
  BAR_RAISER: { bucket: "final" },
  CULTURE: { bucket: "final" },

  OFFER: { bucket: "offers" },
  OFFERED: { bucket: "offers" },
  OFFER_EXTENDED: { bucket: "offers" },
  NEGOTIATION: { bucket: "offers" },

  HIRED: { bucket: "joined" },
  JOINED: { bucket: "joined" },
  ONBOARDING: { bucket: "joined" },

  REJECTED: { bucket: "rejected" },
  DECLINED: { bucket: "rejected" },
  NOT_SELECTED: { bucket: "rejected" },

  DNP: { bucket: "dnp" },
  NO_SHOW: { bucket: "dnp" },
  DID_NOT_PICKUP: { bucket: "dnp" },
  GHOSTED: { bucket: "dnp" },
};

/** Substring patterns (uppercase) checked when no exact key match */
const STAGE_KEY_SUBSTRING_RULES: { includes: string; bucket: EodMetricBucket }[] = [
  { includes: "SCREEN", bucket: "screening" },
  { includes: "ROUND_1", bucket: "round1" },
  { includes: "ROUND1", bucket: "round1" },
  { includes: "ROUND_2", bucket: "round2" },
  { includes: "ROUND2", bucket: "round2" },
  { includes: "FINAL", bucket: "final" },
  { includes: "OFFER", bucket: "offers" },
  { includes: "HIRED", bucket: "joined" },
  { includes: "JOIN", bucket: "joined" },
  { includes: "REJECT", bucket: "rejected" },
  { includes: "DNP", bucket: "dnp" },
  { includes: "NO_SHOW", bucket: "dnp" },
];

/**
 * Resolve EOD bucket for a pipeline stage key.
 * Uses explicit map, then substring rules, then stage flags, else `other`.
 */
export function eodBucketForStageKey(
  stageKey: string,
  flags?: { isHired?: boolean; isRejected?: boolean },
): EodMetricBucket {
  const key = stageKey.trim().toUpperCase();
  const explicit = STAGE_KEY_TO_EOD_BUCKET[key];
  if (explicit) return explicit.bucket;

  for (const rule of STAGE_KEY_SUBSTRING_RULES) {
    if (key.includes(rule.includes)) return rule.bucket;
  }

  if (flags?.isHired) return "joined";
  if (flags?.isRejected) return "rejected";

  return "other";
}

/** Export full map for API consumers (keys uppercased) */
export function getStageMetricMapForApi(): Record<string, EodMetricBucket> {
  const out: Record<string, EodMetricBucket> = {};
  for (const [k, v] of Object.entries(STAGE_KEY_TO_EOD_BUCKET)) {
    out[k] = v.bucket;
  }
  return out;
}
