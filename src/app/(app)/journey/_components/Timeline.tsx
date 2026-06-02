"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JourneyMilestone } from "../_data/mockEmployeeData";
import { groupMilestonesByYear } from "./journey-theme";
import { TimelineCard } from "./TimelineCard";

type Props = {
  milestones: JourneyMilestone[];
};

function TimelineDot({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "z-10 flex size-6 items-center justify-center rounded-full border-2 border-sky-400 bg-white",
        className,
      )}
      aria-hidden
    >
      <span className="size-2 rounded-full bg-sky-500" />
    </span>
  );
}

export function Timeline({ milestones }: Props) {
  const byYear = groupMilestonesByYear(milestones);
  const years = Object.keys(byYear).sort((a, b) => Number(b) - Number(a));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleYear = (year: string) => {
    setCollapsed((prev) => ({ ...prev, [year]: !prev[year] }));
  };

  let milestoneIndex = 0;

  return (
    <section aria-label="Career timeline">
      <h2 className="text-sm font-semibold text-ink-600 mb-1">Your timeline</h2>
      <p className="text-sm text-ink-400 mb-5">
        Milestones that shaped your journey at SIB
      </p>

      <div className="relative w-full">
        {/* Center spine (desktop) */}
        <div
          className="absolute left-1/2 top-0 bottom-0 hidden w-0.5 -translate-x-1/2 bg-gradient-to-b from-sky-200 to-orange-300 md:block"
          aria-hidden
        />
        {/* Left spine (mobile) */}
        <div
          className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-sky-200 to-orange-300 md:hidden"
          aria-hidden
        />

        <div className="space-y-8">
          {years.map((year) => {
            const isCollapsed = collapsed[year];
            const items = byYear[year];
            return (
              <div key={year}>
                <button
                  type="button"
                  onClick={() => toggleYear(year)}
                  className="relative z-10 mx-auto mb-3 flex w-full max-w-xs items-center justify-center gap-2 rounded-lg px-2 py-1 text-center transition-colors hover:bg-ink-50 md:max-w-none"
                  aria-expanded={!isCollapsed}
                >
                  <span className="text-base font-bold text-ink-700">{year}</span>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-400">
                    {items.length}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-ink-400 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                    aria-hidden
                  />
                </button>

                {!isCollapsed && (
                  <ol className="space-y-6">
                    {items.map((m) => {
                      const isLeft = milestoneIndex % 2 === 0;
                      milestoneIndex += 1;

                      return (
                        <li key={m.id} className="relative">
                          {/* Desktop: alternating sides */}
                          <div className="hidden items-start md:flex">
                            <div className="flex w-1/2 justify-end pr-8">
                              {isLeft ? (
                                <div className="w-full max-w-md">
                                  <TimelineCard milestone={m} />
                                </div>
                              ) : null}
                            </div>
                            <TimelineDot className="absolute left-1/2 top-5 -translate-x-1/2" />
                            <div className="w-1/2 pl-8">
                              {!isLeft ? (
                                <div className="w-full max-w-md">
                                  <TimelineCard milestone={m} />
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {/* Mobile: single column beside left spine */}
                          <div className="relative pl-10 md:hidden">
                            <TimelineDot className="absolute left-0 top-5" />
                            <TimelineCard milestone={m} />
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
