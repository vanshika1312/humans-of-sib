import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { CelebrationEntry } from "@/lib/celebrations";

function celebrationLabel(entry: CelebrationEntry) {
  if (entry.kind === "birthday") {
    const date = formatDate(entry.next, { day: "2-digit", month: "long" });
    return entry.isToday ? `🎂 Today · ${date}` : `🎂 ${date}`;
  }
  const y = entry.years ?? 0;
  const yearWord = y === 1 ? "year" : "years";
  const date = formatDate(entry.next, { day: "2-digit", month: "long" });
  return entry.isToday
    ? `🎉 ${y} ${yearWord} at SIB · TODAY`
    : `🎉 ${y} ${yearWord} on ${date}`;
}

export function CelebrationCard({ entry }: { entry: CelebrationEntry }) {
  const tone = entry.kind === "birthday" ? "text-orange-600" : "text-sky-600";

  return (
    <Card className={entry.isToday ? "brand-gradient confetti" : undefined}>
      <CardContent className={entry.isToday ? "pt-5 bg-white/90 rounded-xl m-0.5" : "pt-5"}>
        <Link href={`/people/${entry.userId}`} className="flex items-center gap-3 group">
          <Avatar src={entry.image} name={entry.name} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-ink-700 group-hover:text-sky-700 transition-colors">
              {entry.name}
            </div>
            <div className="text-xs text-ink-400 flex items-center gap-1.5 flex-wrap mt-0.5">
              {entry.department && (
                <Badge tone="sky">
                  {entry.department.emoji} {entry.department.name}
                </Badge>
              )}
              {entry.cityName && <Badge tone="ink">📍 {entry.cityName}</Badge>}
            </div>
            {entry.kind === "work-aversary" && entry.joinedAt && (
              <div className="text-xs text-ink-400 mt-0.5">Joined {formatDate(entry.joinedAt)}</div>
            )}
            <div className={`mt-1 text-sm font-medium ${tone}`}>{celebrationLabel(entry)}</div>
            {!entry.isToday && entry.daysUntil > 0 && (
              <div className="text-xs text-ink-400 mt-0.5">
                In {entry.daysUntil} {entry.daysUntil === 1 ? "day" : "days"}
              </div>
            )}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
