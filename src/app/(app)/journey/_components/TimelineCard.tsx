"use client";

import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { JourneyMilestone } from "../_data/mockEmployeeData";
import { MILESTONE_META } from "./journey-theme";

type Props = {
  milestone: JourneyMilestone;
};

export function TimelineCard({ milestone }: Props) {
  const meta = MILESTONE_META[milestone.type];

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="py-4">
        <div className="flex gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-lg"
            aria-hidden
          >
            {meta.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold leading-snug text-ink-700">{milestone.title}</h3>
              <time
                dateTime={milestone.date}
                className="shrink-0 text-xs tabular-nums text-ink-400"
              >
                {formatDate(milestone.date)}
              </time>
            </div>
            <Badge tone="ink" className="mt-1.5">
              {meta.label}
            </Badge>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              {milestone.description}
            </p>
            {milestone.issuedBy && (
              <p className="mt-2 text-xs text-ink-400">
                {milestone.type === "award" || milestone.type === "recognition"
                  ? "Given by"
                  : "Issued by"}{" "}
                <span className="font-medium text-ink-600">{milestone.issuedBy}</span>
              </p>
            )}
          </div>
        </div>
        {milestone.thumbnailUrl && (
          <div className="mt-3 overflow-hidden rounded-lg border border-ink-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={milestone.thumbnailUrl}
              alt=""
              className="h-20 w-full object-cover"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
