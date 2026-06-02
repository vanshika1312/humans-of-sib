/** Calendar helpers for birthdays and work-aversaries (IST wall dates). */

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Next calendar occurrence of month/day on or after `from`. */
export function nextOccurrence(monthDay: Date, from = startOfDay()) {
  const y = from.getFullYear();
  const next = new Date(y, monthDay.getMonth(), monthDay.getDate());
  next.setHours(0, 0, 0, 0);
  if (next < from) next.setFullYear(y + 1);
  return next;
}

export function daysUntil(target: Date, from = startOfDay()) {
  const ms = startOfDay(target).getTime() - startOfDay(from).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/** Whole years completed at `on` (typically the upcoming anniversary date). */
export function workAnniversaryYears(joinedAt: Date, on: Date) {
  let years = on.getFullYear() - joinedAt.getFullYear();
  const m = joinedAt.getMonth();
  const d = joinedAt.getDate();
  if (on.getMonth() < m || (on.getMonth() === m && on.getDate() < d)) years--;
  return years;
}

export const CELEBRATIONS_HORIZON_DAYS = 30;

export type CelebrationKind = "birthday" | "work-aversary";

export type CelebrationEntry = {
  kind: CelebrationKind;
  userId: string;
  name: string;
  image: string | null;
  next: Date;
  daysUntil: number;
  isToday: boolean;
  department?: { name: string; emoji: string | null } | null;
  cityName?: string | null;
  joinedAt?: Date;
  years?: number;
};
