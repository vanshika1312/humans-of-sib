import { prisma } from "@/lib/prisma";

export const QUANTITY_UNIT_PRESETS = [
  "units",
  "interviews",
  "calls",
  "hours",
  "minutes",
  "seconds",
  "posts",
  "reels",
  "tickets",
] as const;

export type QuantityUnitPreset = (typeof QUANTITY_UNIT_PRESETS)[number];

export function formatQuantityLabel(quantity: number, unit: string): string {
  const n = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1).replace(/\.0$/, "");
  return `${n} ${unit}`;
}

export type WorkTrackingConfigRow = {
  eodDeadlineHour: number;
  eodDeadlineMinute: number;
  minEodCompliancePct: number;
  pipEfficiencyThreshold: number;
  pipConsecutiveWeeks: number;
};

const DEFAULTS: WorkTrackingConfigRow = {
  eodDeadlineHour: 18,
  eodDeadlineMinute: 30,
  minEodCompliancePct: 90,
  pipEfficiencyThreshold: 60,
  pipConsecutiveWeeks: 3,
};

export async function getWorkTrackingConfig(): Promise<WorkTrackingConfigRow> {
  const row = await prisma.workTrackingConfig.findUnique({ where: { id: "singleton" } });
  if (!row) return DEFAULTS;
  return {
    eodDeadlineHour: row.eodDeadlineHour,
    eodDeadlineMinute: row.eodDeadlineMinute,
    minEodCompliancePct: row.minEodCompliancePct,
    pipEfficiencyThreshold: row.pipEfficiencyThreshold,
    pipConsecutiveWeeks: row.pipConsecutiveWeeks,
  };
}

export function formatEodDeadline(config: WorkTrackingConfigRow): string {
  const h = config.eodDeadlineHour;
  const m = config.eodDeadlineMinute.toString().padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${m} ${period}`;
}

export function isPastEodDeadline(workDate: Date, config: WorkTrackingConfigRow, now = new Date()): boolean {
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const wd = new Date(workDate);
  if (wd.getTime() < today.getTime()) return true;
  if (wd.getTime() > today.getTime()) return false;
  const deadline = new Date(now);
  deadline.setHours(config.eodDeadlineHour, config.eodDeadlineMinute, 0, 0);
  return now.getTime() > deadline.getTime();
}
