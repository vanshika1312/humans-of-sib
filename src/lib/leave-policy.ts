/**
 * Skillinabox leave policy (half-years):
 * - Balances reset end of June and end of December (H1: Jan–Jun, H2: Jul–Dec).
 * - Probation: no paid casual/sick (until probationEndsAt passes).
 * - Confirmed: 1 casual per calendar month of service within the half (unused carries within the half).
 * - Sick: 3 days per half (non-probation).
 */

import { eachUtcCalendarWorkingDay, halfYearPeriodUtcCalendar } from "@/lib/calendar-date";

export function stripTime(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getHalfYearPeriod(ref: Date): { periodYear: number; half: 1 | 2 } {
  const m = ref.getMonth() + 1;
  return m <= 6
    ? { periodYear: ref.getFullYear(), half: 1 }
    : { periodYear: ref.getFullYear(), half: 2 };
}

/** True if still on probation on ref date (inclusive of probationEndsAt day). */
export function isOnProbation(probationEndsAt: Date | null, ref: Date): boolean {
  if (!probationEndsAt) return false;
  return stripTime(ref).getTime() <= stripTime(probationEndsAt).getTime();
}

/**
 * Casual months accrued in current half: calendar months from join (or half start)
 * through ref, capped at 6, only months inside the half.
 */
export function casualAccruedMonthsInHalf(joinedAt: Date, refDate: Date): number {
  const { periodYear, half } = getHalfYearPeriod(refDate);
  const halfStartMonth = half === 1 ? 0 : 6;
  const halfEndMonth = half === 1 ? 5 : 11;

  const halfStart = new Date(periodYear, halfStartMonth, 1);
  const halfEnd = new Date(periodYear, halfEndMonth + 1, 0);

  const joined = stripTime(joinedAt);
  const ref = stripTime(refDate);

  const effectiveStart = joined.getTime() > halfStart.getTime() ? joined : halfStart;
  if (effectiveStart.getTime() > ref.getTime()) return 0;

  const until = ref.getTime() < halfEnd.getTime() ? ref : halfEnd;

  let months = 0;
  const cur = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
  const endCap = new Date(until.getFullYear(), until.getMonth(), 1);

  while (cur.getTime() <= endCap.getTime()) {
    const mi = cur.getMonth();
    if (mi >= halfStartMonth && mi <= halfEndMonth) months++;
    cur.setMonth(cur.getMonth() + 1);
  }

  return Math.min(6, months);
}

export function casualEntitled(probationEndsAt: Date | null, joinedAt: Date, refDate: Date): number {
  if (isOnProbation(probationEndsAt, refDate)) return 0;
  return casualAccruedMonthsInHalf(joinedAt, refDate);
}

export function sickEntitledPerHalf(probationEndsAt: Date | null, refDate: Date): number {
  if (isOnProbation(probationEndsAt, refDate)) return 0;
  return 3;
}

export function casualRemaining(opts: {
  probationEndsAt: Date | null;
  joinedAt: Date;
  refDate: Date;
  casualUsed: number;
}): number {
  return Math.max(0, casualEntitled(opts.probationEndsAt, opts.joinedAt, opts.refDate) - opts.casualUsed);
}

export function sickRemaining(opts: {
  probationEndsAt: Date | null;
  refDate: Date;
  sickUsed: number;
}): number {
  return Math.max(0, sickEntitledPerHalf(opts.probationEndsAt, opts.refDate) - opts.sickUsed);
}

/** Mon–Sat dates from start through end (inclusive), using UTC calendar days (leave @db.Date ranges). */
export function eachWorkingDay(start: Date, end: Date): Date[] {
  return eachUtcCalendarWorkingDay(start, end);
}

/** Count working days per half bucket key `periodYear-half` e.g. `2026-1`. */
export function workingDaysByHalfYear(start: Date, end: Date): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of eachUtcCalendarWorkingDay(start, end)) {
    const { periodYear, half } = halfYearPeriodUtcCalendar(d);
    const key = `${periodYear}-${half}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

/**
 * Same as {@link workingDaysByHalfYear}, but for an approved half-day leave the debit is **0.5 ×** each bucket
 * (submit enforces a single working day in range when `isHalfDay` is true).
 */
export function workingDaysByHalfYearForLeave(start: Date, end: Date, isHalfDay: boolean): Map<string, number> {
  const base = workingDaysByHalfYear(start, end);
  if (!isHalfDay) return base;
  const out = new Map<string, number>();
  for (const [k, v] of base.entries()) {
    out.set(k, v * 0.5);
  }
  return out;
}

export function parseHalfKey(key: string): { periodYear: number; half: 1 | 2 } {
  const [y, h] = key.split("-").map(Number);
  return { periodYear: y, half: h === 2 ? 2 : 1 };
}

export function workingDaysInHalf(
  start: Date,
  end: Date,
  periodYear: number,
  half: 1 | 2,
): Date[] {
  return eachUtcCalendarWorkingDay(start, end).filter((d) => {
    const p = halfYearPeriodUtcCalendar(d);
    return p.periodYear === periodYear && p.half === half;
  });
}
