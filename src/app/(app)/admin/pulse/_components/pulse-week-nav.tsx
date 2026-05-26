"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addWeeks, calendarDateToParam } from "@/lib/pulse";

type Props = {
  weekStart: Date;
  weekParam: string;
};

export function PulseWeekNav({ weekStart, weekParam }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(week: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("week", calendarDateToParam(week));
    router.push(`${pathname}?${params.toString()}`);
  }

  const prev = addWeeks(weekStart, -1);
  const next = addWeeks(weekStart, 1);
  const todayWeek = calendarDateToParam(addWeeks(new Date(), 0));
  const isCurrentWeek = weekParam === todayWeek;

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-2.5"
        onClick={() => go(prev)}
        aria-label="Previous week"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-sm font-medium text-ink-600 tabular-nums px-1">Week of {weekParam}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-2.5"
        onClick={() => go(next)}
        aria-label="Next week"
      >
        <ChevronRight className="size-4" />
      </Button>
      {!isCurrentWeek && (
        <Button type="button" variant="ghost" size="sm" className="h-9 text-sky-600" onClick={() => go(addWeeks(new Date(), 0))}>
          This week
        </Button>
      )}
    </div>
  );
}
