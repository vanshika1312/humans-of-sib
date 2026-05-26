import { calendarDateToParam } from "@/lib/pulse";
import { formatDate } from "@/lib/utils";

type Point = { weekStart: Date; avgScore: number; responseCount: number };

export function PulseAdminTrendChart({
  points,
  highlightWeek,
}: {
  points: Point[];
  highlightWeek: Date;
}) {
  const highlightKey = calendarDateToParam(highlightWeek);
  const maxScore = 5;
  const maxBarPx = 112;

  return (
    <div className="flex items-end justify-between gap-1.5 h-36 pt-2" role="img" aria-label="Team pulse trend by week">
      {points.map((p) => {
        const key = calendarDateToParam(p.weekStart);
        const barH =
          p.responseCount > 0 ? Math.max(6, Math.round((p.avgScore / maxScore) * maxBarPx)) : 4;
        const isHighlight = key === highlightKey;
        return (
          <div key={key} className="flex flex-1 flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] font-medium text-ink-500 tabular-nums">
              {p.responseCount > 0 ? p.avgScore : "—"}
            </span>
            <div
              className={`w-full max-w-[2.5rem] rounded-t-md ${isHighlight ? "bg-orange-500" : "bg-orange-300"}`}
              style={{ height: barH }}
              title={`${formatDate(p.weekStart)}: ${p.responseCount} responses`}
            />
            <span className="text-[9px] text-ink-400 truncate w-full text-center">
              {p.weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}
