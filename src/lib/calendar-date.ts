/**
 * Calendar-date helpers for Postgres @db.Date and HTML <input type="date"> values.
 *
 * Local-midnight JS Dates skew the saved day ahead/behind in non-UTC timezones.
 * Encode picked Y-M-D as UTC midnight so the DATE column matches the picker.
 */

export function utcCalendarMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Parse HTML date value (YYYY-MM-DD) → UTC midnight on that calendar day. */
export function calendarDateFromInput(ymd: string): Date {
  const [y, m, da] = ymd.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(da)) {
    return new Date(NaN);
  }
  return new Date(Date.UTC(y, m - 1, da, 0, 0, 0, 0));
}

/** Show the calendar day stored in a @db.Date (safe in any server TZ). */
export function formatCalendarDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function workingDaysInclusiveUtcCalendar(start: Date, end: Date): number {
  const s = utcCalendarMidnight(start);
  const e = utcCalendarMidnight(end);
  let n = 0;
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

export function nextUtcWorkingDayAfter(date: Date): Date {
  const d = utcCalendarMidnight(date);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Mon–Fri on the UTC calendar from start through end (inclusive). */
export function eachUtcCalendarWorkingDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const s = utcCalendarMidnight(start);
  const e = utcCalendarMidnight(end);
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(new Date(d));
  }
  return out;
}

export function halfYearPeriodUtcCalendar(ref: Date): { periodYear: number; half: 1 | 2 } {
  const m = ref.getUTCMonth() + 1;
  return m <= 6 ? { periodYear: ref.getUTCFullYear(), half: 1 } : { periodYear: ref.getUTCFullYear(), half: 2 };
}
