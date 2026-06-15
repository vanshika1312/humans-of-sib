/** Calendar date helpers for work tracking (IST-oriented display; stored as UTC midnight dates). */

export function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function todayDateOnly(): Date {
  const now = new Date();
  return toDateOnly(now);
}

export function formatWorkDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseWorkDateParam(raw: string | undefined): Date {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayDateOnly();
  const [y, m, day] = raw.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function startOfWeekMonday(date: Date): Date {
  const d = toDateOnly(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function daysInRange(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  let cur = toDateOnly(start);
  const last = toDateOnly(end);
  while (cur.getTime() <= last.getTime()) {
    out.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return out;
}
