import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { upcomingHolidays } from "@/lib/holidays";
import { CalendarDays } from "lucide-react";

export function HolidayCalendar() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = upcomingHolidays(today, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-sky-600" /> Upcoming holidays
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

