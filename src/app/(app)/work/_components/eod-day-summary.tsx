"use client";

import { calcQuantityEfficiency, calcQuantityTotals, type QuantityTaskInput } from "@/lib/work-tracking/efficiency";
import type { DailyTaskEodStatus } from "@/generated/prisma";

export function EodDaySummary({ tasks }: { tasks: QuantityTaskInput[] }) {
  const efficiencyPct = calcQuantityEfficiency(tasks);
  const { assigned, delivered } = calcQuantityTotals(tasks);

  const barColor =
    efficiencyPct >= 75 ? "bg-emerald-500" : efficiencyPct >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-ink-600">
          Day total: <strong className="text-ink-800">{delivered}</strong> / {assigned} delivered
        </span>
        <span className="font-medium text-ink-800">Projected efficiency: {efficiencyPct}%</span>
      </div>
      <div className="h-2 bg-ink-100 rounded overflow-hidden">
        <div
          className={`h-full rounded transition-all ${barColor}`}
          style={{ width: `${efficiencyPct}%` }}
        />
      </div>
    </div>
  );
}

export type EodTaskValues = {
  taskId: string;
  targetQuantity: number;
  actual: number;
  status: DailyTaskEodStatus;
};

export function toQuantityInputs(values: EodTaskValues[]): QuantityTaskInput[] {
  return values.map((v) => ({
    targetQuantity: v.targetQuantity,
    actualQuantity: v.actual,
    eodStatus: v.status,
  }));
}
