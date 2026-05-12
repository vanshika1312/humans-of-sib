import type { HiringPipelineStage, Prisma } from "@/generated/prisma";

import { prisma } from "@/lib/prisma";

export async function loadPipelineStagesOrdered(): Promise<HiringPipelineStage[]> {
  return prisma.hiringPipelineStage.findMany({ orderBy: { sortOrder: "asc" } });
}

/** Default stage for new applications (prefer APPLIED key). */
export async function defaultAppliedPipelineStageId(): Promise<string> {
  const rows = await loadPipelineStagesOrdered();
  const applied = rows.find((r) => r.key === "APPLIED");
  const pick = applied ?? rows[0];
  if (!pick?.id) {
    throw new Error("Misconfigured ATS: define at least one pipeline stage.");
  }
  return pick.id;
}

export async function defaultAppliedPipelineStageIdInTxn(tx: Prisma.TransactionClient): Promise<string> {
  const applied = await tx.hiringPipelineStage.findFirst({
    where: { key: "APPLIED" },
    select: { id: true },
  });
  if (applied) return applied.id;
  const first = await tx.hiringPipelineStage.findFirst({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!first) throw new Error("NO_PIPELINE_STAGES");
  return first.id;
}

export function funnelActiveFilter(stages: HiringPipelineStage[]): HiringPipelineStage[] {
  return stages.filter((s) => !s.isHired && !s.isRejected);
}
