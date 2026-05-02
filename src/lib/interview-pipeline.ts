import { prisma } from "@/lib/prisma";

export type PipelineStageSeed = {
  sortOrder: number;
  slug: string;
  label: string;
  count: number;
};

export const INTERVIEW_PIPELINE_DEFAULTS: PipelineStageSeed[] = [
  { sortOrder: 0, slug: "screening", label: "Screening", count: 45 },
  { sortOrder: 1, slug: "round1", label: "Round 1", count: 15 },
  { sortOrder: 2, slug: "round2", label: "Round 2", count: 10 },
  { sortOrder: 3, slug: "final", label: "Final Round", count: 8 },
  { sortOrder: 4, slug: "offers", label: "Offers", count: 7 },
  { sortOrder: 5, slug: "joined", label: "Joined", count: 5 },
];

/** Creates default stages once; preserves existing counts on deploy. */
export async function ensureInterviewPipelineStages(): Promise<void> {
  for (const row of INTERVIEW_PIPELINE_DEFAULTS) {
    await prisma.interviewPipelineStage.upsert({
      where: { slug: row.slug },
      create: {
        sortOrder: row.sortOrder,
        slug: row.slug,
        label: row.label,
        count: row.count,
      },
      update: {},
    });
  }
}

export async function getInterviewPipelineStagesOrdered() {
  await ensureInterviewPipelineStages();
  return prisma.interviewPipelineStage.findMany({
    orderBy: { sortOrder: "asc" },
  });
}

export const PIPELINE_STAGE_BAR_HEX: Record<string, string> = {
  screening: "#4f8fea",
  round1: "#a78bfa",
  round2: "#8848e9",
  final: "#f26522",
  offers: "#34d399",
  joined: "#10b981",
};

const FOOTER_TRANSITION_LABEL = [
  "Screening → R1",
  "R1 → R2",
  "R2 → Final",
  "Final → Offer",
  "Offer → Joined",
] as const;

type PipelineFooterCell = {
  pct: number | null;
  label: string;
  toneClass: string;
};

export function pipelineFooterCells(stages: { count: number }[]): {
  cells: PipelineFooterCell[];
  overallPct: number | null;
  columnCount: number;
} {
  const top = stages[0]?.count ?? 0;
  const last = stages[stages.length - 1];
  const edgeCount = Math.max(0, stages.length - 1);

  const cells: PipelineFooterCell[] = [];
  for (let i = 0; i < edgeCount; i++) {
    const s = stages[i];
    const next = stages[i + 1];
    const pct =
      !s || s.count <= 0 || !next ? null : Math.round((next.count / s.count) * 100);
    cells.push({
      pct,
      label: FOOTER_TRANSITION_LABEL[i] ?? `Stage → ${i + 2}`,
      toneClass: footerTone(i),
    });
  }

  const overallPct =
    top <= 0 || !last ? null : Math.round((last.count / top) * 100);

  return { cells, overallPct, columnCount: cells.length + 1 };
}

function footerTone(colIdx: number) {
  if (colIdx === 0) return "text-amber-300";
  return "text-emerald-400";
}

export function footerOverallToneClass() {
  return "text-rose-400";
}
