"use client";

import {
  GraduationCap,
  Award,
  Trophy,
  TrendingUp,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MockEmployeeJourney } from "../_data/mockEmployeeData";

const STAT_ICONS = [GraduationCap, Award, Trophy, TrendingUp, Star] as const;

const TONE_CLASSES = [
  "text-sky-600 bg-sky-50",
  "text-orange-600 bg-orange-50",
  "text-sun-600 bg-sun-50",
  "text-sky-600 bg-sky-50",
  "text-ink-600 bg-ink-100",
] as const;

type Props = {
  stats: MockEmployeeJourney["stats"];
};

export function StatsRibbon({ stats }: Props) {
  const items = [
    { label: "Trainings completed", value: stats.trainingsCompleted },
    { label: "Certifications earned", value: stats.certificationsEarned },
    { label: "Awards & recognitions", value: stats.awardsCount },
    { label: "Designations held", value: stats.designationsHeld },
    { label: "Performance ratings", value: stats.performanceSummary, isText: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
      {items.map((item, i) => {
        const Icon = STAT_ICONS[i];
        return (
          <div
            key={item.label}
            className="rounded-xl border border-ink-100 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <div
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-md",
                TONE_CLASSES[i],
              )}
            >
              <Icon className="size-5" aria-hidden />
            </div>
            <div
              className={cn(
                "mt-2 font-bold tabular-nums text-ink-700",
                item.isText ? "text-sm leading-snug" : "text-xl",
              )}
            >
              {item.value}
            </div>
            <div className="mt-0.5 text-xs text-ink-400">{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}
