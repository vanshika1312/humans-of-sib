import { prisma } from "@/lib/prisma";
import type { DeptOkrMetricUnit } from "@/generated/prisma";

/** Recalculate KR currentValue from completed EOD quantities in the objective's period. */
export async function refreshKeyResultProgress(keyResultId: string) {
  const kr = await prisma.deptOkrKeyResult.findUnique({
    where: { id: keyResultId },
    include: {
      objective: true,
      taskType: true,
    },
  });
  if (!kr) return;

  const { objective } = kr;
  const periodFilter: { gte: Date; lte: Date } = buildPeriodRange(objective.year, objective.cycle, objective.quarter, objective.month);

  const linkedTasks = await prisma.dailyWorkTask.findMany({
    where: {
      keyResultId,
      workDate: periodFilter,
      eodStatus: { in: ["COMPLETED", "PARTIAL"] },
    },
    select: { actualQuantity: true, eodStatus: true, targetQuantity: true },
  });

  let autoLinkedTasks: typeof linkedTasks = [];
  if (kr.taskTypeId) {
    autoLinkedTasks = await prisma.dailyWorkTask.findMany({
      where: {
        keyResultId: null,
        taskTypeId: kr.taskTypeId,
        departmentId: objective.departmentId,
        workDate: periodFilter,
        eodStatus: { in: ["COMPLETED", "PARTIAL"] },
      },
      select: { actualQuantity: true, eodStatus: true, targetQuantity: true },
    });
  }

  const tasks = [...linkedTasks, ...autoLinkedTasks];

  let currentValue = 0;
  if (kr.unit === "PERCENT") {
    const totals = tasks.reduce(
      (acc, t) => {
        acc.target += Number(t.targetQuantity);
        acc.actual += Number(t.actualQuantity ?? 0);
        return acc;
      },
      { target: 0, actual: 0 },
    );
    currentValue = totals.target > 0 ? Math.round((totals.actual / totals.target) * 100) : 0;
  } else {
    currentValue = tasks.reduce((sum, t) => {
      if (t.eodStatus === "COMPLETED") return sum + Number(t.actualQuantity ?? t.targetQuantity);
      if (t.eodStatus === "PARTIAL") return sum + Number(t.actualQuantity ?? 0);
      return sum;
    }, 0);
  }

  const progressPct = kr.targetValue.gt(0)
    ? Math.min(100, Math.round((currentValue / Number(kr.targetValue)) * 100))
    : 0;

  await prisma.deptOkrKeyResult.update({
    where: { id: keyResultId },
    data: { currentValue },
  });

  const allKrs = await prisma.deptOkrKeyResult.findMany({
    where: { objectiveId: objective.id },
    select: { currentValue: true, targetValue: true, weight: true },
  });

  let weightedProgress = 0;
  let totalWeight = 0;
  for (const k of allKrs) {
    const w = k.weight || 1;
    totalWeight += w;
    const pct = k.targetValue.gt(0) ? (Number(k.currentValue) / Number(k.targetValue)) * 100 : 0;
    weightedProgress += pct * w;
  }
  const objectiveProgress = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : progressPct;

  await prisma.deptOkrObjective.update({
    where: { id: objective.id },
    data: {
      status:
        objectiveProgress >= 100
          ? "COMPLETED"
          : objectiveProgress < 50
            ? "OFF_TRACK"
            : objectiveProgress < 75
              ? "AT_RISK"
              : "ON_TRACK",
    },
  });

  return { currentValue, objectiveProgress };
}

function buildPeriodRange(
  year: number,
  cycle: string,
  quarter: number | null,
  month: number | null,
): { gte: Date; lte: Date } {
  if (cycle === "MONTH" && month) {
    const gte = new Date(Date.UTC(year, month - 1, 1));
    const lte = new Date(Date.UTC(year, month, 0));
    return { gte, lte };
  }
  if (cycle === "QUARTER" && quarter) {
    const startMonth = (quarter - 1) * 3;
    const gte = new Date(Date.UTC(year, startMonth, 1));
    const lte = new Date(Date.UTC(year, startMonth + 3, 0));
    return { gte, lte };
  }
  const gte = new Date(Date.UTC(year, 0, 1));
  const lte = new Date(Date.UTC(year, 11, 31));
  return { gte, lte };
}

export function formatKrUnit(unit: DeptOkrMetricUnit, unitLabel?: string | null): string {
  switch (unit) {
    case "PERCENT":
      return "%";
    case "CURRENCY":
      return "₹";
    default:
      return unitLabel ? ` ${unitLabel}` : "";
  }
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function currentOkrPeriod(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return { year, month, quarter };
}

export function formatOkrPeriodLabel(cycle: string, year: number, quarter: number | null, month: number | null): string {
  if (cycle === "MONTH" && month) {
    const q = quarter ?? Math.ceil(month / 3);
    return `Q${q} · ${MONTH_SHORT[month - 1]}`;
  }
  if (cycle === "QUARTER" && quarter) {
    return `Q${quarter} · ${year}`;
  }
  return String(year);
}

export function isCurrentPeriodObjective(
  objective: { year: number; cycle: string; quarter: number | null; month: number | null },
  now = new Date(),
): boolean {
  const { year, month, quarter } = currentOkrPeriod(now);
  if (objective.year !== year) return false;
  if (objective.cycle === "MONTH") return objective.month === month;
  if (objective.cycle === "QUARTER") return objective.quarter === quarter;
  return false;
}

export function calcKrProgressPct(currentValue: number, targetValue: number): number {
  return targetValue > 0 ? Math.min(100, Math.round((currentValue / targetValue) * 100)) : 0;
}

export function calcObjectiveProgress(
  keyResults: { currentValue: { toString(): string }; targetValue: { toString(): string }; weight: number }[],
): number {
  if (keyResults.length === 0) return 0;
  let totalWeight = 0;
  let weighted = 0;
  for (const kr of keyResults) {
    const w = kr.weight || 1;
    totalWeight += w;
    weighted += calcKrProgressPct(Number(kr.currentValue), Number(kr.targetValue)) * w;
  }
  return totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;
}

export function formatKrProgressLabel(
  currentValue: number,
  targetValue: number,
  unit: DeptOkrMetricUnit,
  unitLabel?: string | null,
): string {
  if (unit === "PERCENT") {
    return `${calcKrProgressPct(currentValue, targetValue)}%`;
  }
  if (unit === "CURRENCY") {
    return `₹${formatKrNumber(currentValue)} / ₹${formatKrNumber(targetValue)}`;
  }
  const suffix = unitLabel ? ` ${unitLabel}` : "";
  return `${formatKrNumber(currentValue)} / ${formatKrNumber(targetValue)}${suffix}`;
}

function formatKrNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function krProgressBarColor(pct: number): string {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  if (pct >= 25) return "bg-sky-500";
  return "bg-red-500";
}
