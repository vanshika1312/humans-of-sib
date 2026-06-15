import type { DailyTaskEodStatus } from "@/generated/prisma";

export type QuantityTaskInput = {
  targetQuantity: number;
  actualQuantity: number | null;
  eodStatus: DailyTaskEodStatus | null;
};

/** Effective actual for efficiency: uses reported quantity, 0 if not started. */
export function effectiveActual(input: QuantityTaskInput): number {
  if (input.eodStatus === "NOT_STARTED" || input.eodStatus === null) return 0;
  return Number(input.actualQuantity ?? 0);
}

/** Day efficiency: sum(actual) / sum(target) × 100, capped at 100. */
export function calcQuantityEfficiency(tasks: QuantityTaskInput[]): number {
  if (tasks.length === 0) return 0;
  let totalTarget = 0;
  let totalActual = 0;
  for (const t of tasks) {
    const target = Number(t.targetQuantity);
    if (target <= 0) continue;
    totalTarget += target;
    totalActual += Math.min(effectiveActual(t), target);
  }
  if (totalTarget === 0) return 0;
  return Math.round(Math.min(100, (totalActual / totalTarget) * 100));
}

/** Suggest EOD status from quantities; user may override. */
export function suggestEodStatus(targetQuantity: number, actualQuantity: number): DailyTaskEodStatus {
  if (actualQuantity <= 0) return "NOT_STARTED";
  if (actualQuantity >= targetQuantity) return "COMPLETED";
  return "PARTIAL";
}

export type QuantityTotals = { assigned: number; delivered: number };

export function calcQuantityTotals(tasks: QuantityTaskInput[]): QuantityTotals {
  let assigned = 0;
  let delivered = 0;
  for (const t of tasks) {
    assigned += Number(t.targetQuantity);
    delivered += effectiveActual(t);
  }
  return { assigned, delivered };
}

/** @deprecated Use calcQuantityEfficiency — kept for gradual migration */
export type TaskEfficiencyInput = {
  eodStatus: DailyTaskEodStatus | null;
  complexity: import("@/generated/prisma").TaskComplexity;
};

export function calcEfficiency(tasks: TaskEfficiencyInput[]): {
  simplePct: number;
  weightedPct: number;
  primaryPct: number;
} {
  const qtyTasks: QuantityTaskInput[] = tasks.map((t) => ({
    targetQuantity: 1,
    actualQuantity: t.eodStatus === "COMPLETED" ? 1 : t.eodStatus === "PARTIAL" ? 0.5 : 0,
    eodStatus: t.eodStatus,
  }));
  const pct = calcQuantityEfficiency(qtyTasks);
  return { simplePct: pct, weightedPct: pct, primaryPct: pct };
}
