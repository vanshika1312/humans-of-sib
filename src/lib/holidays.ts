export type Holiday = {
  /** ISO date string (YYYY-MM-DD) in local calendar terms. */
  date: string;
  title: string;
  type?: "Public Holiday" | "Company Holiday";
};

// Note: We only include fixed-date holidays here to avoid wrong movable-festival dates.
// Add/adjust holidays as HR publishes the yearly calendar.
export const HOLIDAYS: Holiday[] = [
  { date: "2026-01-26", title: "Republic Day", type: "Public Holiday" },
  { date: "2026-05-01", title: "Labour Day", type: "Public Holiday" },
  { date: "2026-08-15", title: "Independence Day", type: "Public Holiday" },
  { date: "2026-10-02", title: "Gandhi Jayanti", type: "Public Holiday" },
  { date: "2026-12-25", title: "Christmas", type: "Public Holiday" },
];

export function parseHolidayDate(isoDate: string) {
  // Parse as local date (avoid UTC date shifts).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  const d = new Date(y, mm - 1, dd);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function upcomingHolidays(from: Date, limit = 6) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);

  const rows = HOLIDAYS.map((h) => {
    const d = parseHolidayDate(h.date);
    return d ? { ...h, when: d } : null;
  })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .filter((h) => h.when.getTime() >= start.getTime())
    .sort((a, b) => a.when.getTime() - b.when.getTime())
    .slice(0, Math.max(0, limit));

  return rows;
}

