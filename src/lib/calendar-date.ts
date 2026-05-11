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

/** Monday–Saturday are working days; Sunday is off (UTC calendar, matches @db.Date). */
export function isUtcCalendarWorkingDay(d: Date): boolean {
  return utcCalendarMidnight(d).getUTCDay() !== 0;
}

/** Month is 1–12. UTC calendar bounds matching Postgres DATE semantics used for leave/attendance. */
export function utcMonthBounds(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 0, 0, 0, 0));
  return { start, end };
}

/** Count of Mon–Sat days in the UTC calendar month (Sunday excluded). */
export function workingWeekdaysInUtcMonth(year: number, month: number): number {
  const { start, end } = utcMonthBounds(year, month);
  return workingDaysInclusiveUtcCalendar(start, end);
}

export function workingDaysInclusiveUtcCalendar(start: Date, end: Date): number {
  const s = utcCalendarMidnight(start);
  const e = utcCalendarMidnight(end);
  let n = 0;
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    if (isUtcCalendarWorkingDay(d)) n++;
  }
  return n;
}

export function nextUtcWorkingDayAfter(date: Date): Date {
  const d = utcCalendarMidnight(date);
  d.setUTCDate(d.getUTCDate() + 1);
  while (!isUtcCalendarWorkingDay(d)) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Mon–Sat on the UTC calendar from start through end (inclusive). */
export function eachUtcCalendarWorkingDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const s = utcCalendarMidnight(start);
  const e = utcCalendarMidnight(end);
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    if (isUtcCalendarWorkingDay(d)) out.push(new Date(d));
  }
  return out;
}

export function halfYearPeriodUtcCalendar(ref: Date): { periodYear: number; half: 1 | 2 } {
  const m = ref.getUTCMonth() + 1;
  return m <= 6 ? { periodYear: ref.getUTCFullYear(), half: 1 } : { periodYear: ref.getUTCFullYear(), half: 2 };
}

/** Civil time on a stored @db.Date (UTC midnight) in Asia/Kolkata (IST, +05:30, no DST). */
export function utcCalendarDateWithIstClock(dateUtcMidnight: Date, hour: number, minute: number): Date {
  const y = dateUtcMidnight.getUTCFullYear();
  const mo = String(dateUtcMidnight.getUTCMonth() + 1).padStart(2, "0");
  const da = String(dateUtcMidnight.getUTCDate()).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mi = String(minute).padStart(2, "0");
  const ms = Date.parse(`${y}-${mo}-${da}T${hh}:${mi}:00+05:30`);
  if (Number.isNaN(ms)) return new Date(NaN);
  return new Date(ms);
}

/** For `<input type="date" defaultValue={…}>` from a Postgres @db.Date (UTC calendar). */
export function utcCalendarDateToInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const da = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
