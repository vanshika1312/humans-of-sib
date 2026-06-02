"use client";

import { Trophy } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Award } from "../_data/mockEmployeeData";

type Props = {
  awards: Award[];
};

export function AwardsWall({ awards }: Props) {
  return (
    <Card className="overflow-hidden border-sun-100 bg-gradient-to-br from-sun-50/80 via-white to-orange-50/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-5 text-orange-600" aria-hidden />
          Awards & recognition
        </CardTitle>
        <CardDescription>
          Celebrating moments when you went above and beyond
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
          {awards.map((award) => (
            <article
              key={award.id}
              className="min-w-[240px] max-w-[260px] shrink-0 snap-start rounded-xl border border-ink-100 bg-white p-4 shadow-sm"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-orange-50">
                <Trophy className="size-5 text-orange-600" aria-hidden />
              </div>
              <h3 className="mt-3 font-semibold leading-snug text-ink-700">{award.name}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{award.occasion}</p>
              <p className="mt-2 text-xs text-ink-400">Given by {award.givenBy}</p>
              <time
                dateTime={award.date}
                className="mt-1 block text-xs font-medium tabular-nums text-ink-500"
              >
                {formatDate(award.date)}
              </time>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
