"use client";

import type { ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const u = Date.UTC(year, month - 1 + delta, 1);
  return { year: new Date(u).getUTCFullYear(), month: new Date(u).getUTCMonth() + 1 };
}

type Props = {
  year: number;
  month: number;
  yearMin?: number;
  yearMax?: number;
  /** Extra controls after the year dropdown (e.g. “This month” link). */
  endSlot?: ReactNode;
};

export function ReportMonthNav({ year, month, yearMin = 2020, yearMax = 2035, endSlot }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(nyRaw: number, nmRaw: number) {
    const ny = Math.min(yearMax, Math.max(yearMin, nyRaw));
    const nm = Math.min(12, Math.max(1, nmRaw));
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(ny));
    params.set("month", String(nm));
    router.push(`${pathname}?${params.toString()}`);
  }

  const yearOptions: number[] = [];
  for (let y = yearMin; y <= yearMax; y++) yearOptions.push(y);

  const prevMonth = shiftMonth(year, month, -1);
  const nextMonth = shiftMonth(year, month, 1);

  const trailing = typeof endSlot === "number" ? null : endSlot;

  return (
    <div className="inline-flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto sm:overflow-visible">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 px-2.5"
        onClick={() => go(prevMonth.year, prevMonth.month)}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Select
        aria-label="Month"
        className="h-9 w-auto min-w-[8.5rem] shrink-0 bg-none pr-2 text-sm appearance-auto"
        value={String(month)}
        onChange={(e) => go(year, Number(e.target.value))}
      >
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Year"
        className="h-9 w-[6rem] min-w-[6rem] shrink-0 bg-none pr-2 text-sm tabular-nums appearance-auto"
        value={String(year)}
        onChange={(e) => go(Number(e.target.value), month)}
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 px-2.5"
        onClick={() => go(nextMonth.year, nextMonth.month)}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
      {trailing ? <span className="inline-flex shrink-0 items-center">{trailing}</span> : null}
    </div>
  );
}
