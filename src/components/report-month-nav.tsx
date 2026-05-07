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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-2.5"
        onClick={() => go(prevMonth.year, prevMonth.month)}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div className="flex items-center gap-2">
        <Select
          aria-label="Month"
          className="h-9 min-w-[8.5rem] text-sm shrink-0"
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
          className="h-9 min-w-[6rem] w-[6rem] text-sm shrink-0 tabular-nums"
          value={String(year)}
          onChange={(e) => go(Number(e.target.value), month)}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 px-2.5"
        onClick={() => go(nextMonth.year, nextMonth.month)}
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </Button>
      {endSlot}
    </div>
  );
}
