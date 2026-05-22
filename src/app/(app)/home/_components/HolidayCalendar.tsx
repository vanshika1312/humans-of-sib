import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { HOLIDAYS, parseHolidayDate, upcomingHolidays } from "@/lib/holidays";
import { CalendarDays } from "lucide-react";

function monthLabel(d: Date) {
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(d);
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

export function HolidayCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const y = today.getFullYear();
  const m = today.getMonth();
  const firstOfMonth = new Date(y, m, 1);
  const lastDay = daysInMonth(y, m);

  // Convert to Monday-start grid.
  const jsDay = firstOfMonth.getDay(); // 0=Sun
  const mondayStartOffset = (jsDay + 6) % 7; // 0=Mon ... 6=Sun
  const cells: Array<{ day: number | null; isToday: boolean; holidayTitle: string | null }> = [];

  const holidayByDay = new Map<number, string>();
  for (const h of HOLIDAYS) {
    const d = parseHolidayDate(h.date);
    if (!d) continue;
    if (d.getFullYear() !== y || d.getMonth() !== m) continue;
    holidayByDay.set(d.getDate(), h.title);
  }

  for (let i = 0; i < mondayStartOffset; i++) cells.push({ day: null, isToday: false, holidayTitle: null });
  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(y, m, day);
    d.setHours(0, 0, 0, 0);
    cells.push({
      day,
      isToday: d.getTime() === today.getTime(),
      holidayTitle: holidayByDay.get(day) ?? null,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, isToday: false, holidayTitle: null });

  const upcoming = upcomingHolidays(today, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-sky-600" /> Holiday calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-ink-100 bg-white p-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-ink-700">{monthLabel(today)}</div>
            <Badge tone="ink">{holidayByDay.size} holiday{holidayByDay.size === 1 ? "" : "s"}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] text-ink-400">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {cells.map((c, idx) => (
              <div
                key={c.day ? `d-${y}-${m}-${c.day}` : `pad-${y}-${m}-${idx}`}
                title={c.holidayTitle ?? undefined}
                className={cn(
                  "h-8 rounded-md flex items-center justify-center text-sm",
                  c.day ? "text-ink-600" : "text-transparent",
                  c.holidayTitle ? "bg-emerald-50 text-emerald-800" : "bg-ink-50/60",
                  c.isToday && "ring-2 ring-sky-300 bg-sky-50",
                )}
              >
                {c.day ?? "·"}
              </div>
            ))}
          </div>
          {holidayByDay.size === 0 && (
            <div className="mt-3 text-xs text-ink-400">
              No holidays configured for this month yet.
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-300 mb-2">Upcoming</div>
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 bg-white px-4 py-6 text-sm text-ink-500">
              No upcoming holidays are configured.
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((h) => (
                <div key={h.date} className="flex items-start gap-3 rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-ink-700">{h.title}</div>
                      {h.type ? <Badge tone="green">{h.type}</Badge> : null}
                      <span className="text-xs text-ink-400 ml-auto">{formatDate(h.when, { day: "2-digit", month: "short" })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

