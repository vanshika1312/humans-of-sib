"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

const FULL_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function MonthSelector({ year, month }: { year: number; month: number }) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  function navigate(delta: number) {
    let ny = year;
    let nm = month + delta;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1)  { nm = 12; ny--; }
    const params = new URLSearchParams(searchParams.toString());
    params.set("year",  String(ny));
    params.set("month", String(nm));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-lg px-1.5 py-1.5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="p-1 rounded hover:bg-ink-50 text-ink-400 hover:text-ink-700 transition-colors"
        aria-label="Previous month"
      >
        <ChevronLeft className="size-4" />
      </button>
      <div className="flex items-center gap-1.5 px-2 min-w-[130px] justify-center">
        <Calendar className="size-3.5 text-ink-400 shrink-0" />
        <span className="text-sm font-medium text-ink-700 whitespace-nowrap">
          {FULL_MONTHS[month - 1]} {year}
        </span>
      </div>
      <button
        type="button"
        onClick={() => navigate(1)}
        className="p-1 rounded hover:bg-ink-50 text-ink-400 hover:text-ink-700 transition-colors"
        aria-label="Next month"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
