import { prisma } from "@/lib/prisma";

export type RecruitmentFunnelStageSeed = {
  sortOrder: number;
  slug: string;
  label: string;
  count: number;
};

/** Headline strip order — recruitment overview */
export const STRIP_SLUG_ORDER = [
  "total",
  "screening",
  "round1",
  "round2",
  "final",
  "offers",
  "joined",
  "rejected",
  "dnp",
  "offer_rate_pct",
] as const;

export type RecruitmentStripSlug = (typeof STRIP_SLUG_ORDER)[number];

/** Rows that power the horizontal bar funnel (conversion math) */
export const FUNNEL_BAR_SLUG_ORDER = ["screening", "round1", "round2", "final", "offers", "joined"] as const;

/** Defaults until per-applicant sync */
export const RECRUITMENT_FUNNEL_DEFAULTS: RecruitmentFunnelStageSeed[] = [
  { sortOrder: 0, slug: "total", label: "TOTAL", count: 120 },
  { sortOrder: 1, slug: "screening", label: "SCREENING", count: 45 },
  { sortOrder: 2, slug: "round1", label: "ROUND 1", count: 15 },
  { sortOrder: 3, slug: "round2", label: "ROUND 2", count: 10 },
  { sortOrder: 4, slug: "final", label: "FINAL", count: 8 },
  { sortOrder: 5, slug: "offers", label: "OFFERS", count: 7 },
  { sortOrder: 6, slug: "joined", label: "JOINED", count: 5 },
  { sortOrder: 7, slug: "rejected", label: "REJECTED", count: 10 },
  { sortOrder: 8, slug: "dnp", label: "DNP", count: 3 },
  { sortOrder: 9, slug: "offer_rate_pct", label: "OFFER RATE", count: 10 },
];

export function pickStagesBySlugOrder<T extends { slug: string }>(
  stages: T[],
  order: readonly string[],
): T[] {
  const bySlug = new Map(stages.map((s) => [s.slug, s]));
  return order.map((slug) => bySlug.get(slug)).filter(Boolean) as T[];
}

/** Bar colours for funnel rows */
export const FUNNEL_STAGE_HEX: Record<string, string> = {
  screening: "#4f8fea",
  round1: "#a78bfa",
  round2: "#8848e9",
  final: "#f26522",
  offers: "#34d399",
  joined: "#10b981",
};

/** Strip headline number colours (recruitment overview) */
export const METRIC_STRIP_HEX: Record<string, string> = {
  total: "#ffffff",
  screening: "#7dd3fc",
  round1: "#818cf8",
  round2: "#a78bfa",
  final: "#fb923c",
  offers: "#6ee7b7",
  joined: "#2dd4bf",
  rejected: "#fb7185",
  dnp: "#fcd34d",
  offer_rate_pct: "#14b8a6",
};

/** Creates default rows; preserves counts. Keeps labels/sort orders aligned on deploy */
export async function ensureRecruitmentFunnelStages(): Promise<void> {
  for (const row of RECRUITMENT_FUNNEL_DEFAULTS) {
    await prisma.recruitmentFunnelStage.upsert({
      where: { slug: row.slug },
      create: {
        sortOrder: row.sortOrder,
        slug: row.slug,
        label: row.label,
        count: row.count,
      },
      update: {
        sortOrder: row.sortOrder,
        label: row.label,
      },
    });
  }
}

export async function getRecruitmentFunnelStages() {
  await ensureRecruitmentFunnelStages();
  return prisma.recruitmentFunnelStage.findMany({
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });
}

const FUNNEL_TRANSITION_LABEL = [
  "Screening → R1",
  "R1 → R2",
  "R2 → Final",
  "Final → Offer",
  "Offer → Joined",
] as const;

type FunnelFooterCell = {
  pct: number | null;
  label: string;
  toneClass: string;
};

export function funnelFooterCells(barStages: { count: number }[]): {
  cells: FunnelFooterCell[];
  overallPct: number | null;
  columnCount: number;
} {
  const top = barStages[0]?.count ?? 0;
  const last = barStages[barStages.length - 1];
  const edgeCount = Math.max(0, barStages.length - 1);

  const cells: FunnelFooterCell[] = [];
  for (let i = 0; i < edgeCount; i++) {
    const s = barStages[i];
    const next = barStages[i + 1];
    const pct =
      !s || s.count <= 0 || !next ? null : Math.round((next.count / s.count) * 100);
    cells.push({
      pct,
      label: FUNNEL_TRANSITION_LABEL[i] ?? `Stage → ${i + 2}`,
      toneClass: funnelFooterTone(i),
    });
  }

  const overallPct =
    top <= 0 || !last ? null : Math.round((last.count / top) * 100);

  return { cells, overallPct, columnCount: cells.length + 1 };
}

function funnelFooterTone(colIdx: number) {
  if (colIdx === 0) return "text-amber-300";
  return "text-emerald-400";
}

export function funnelOverallToneClass() {
  return "text-rose-400";
}
