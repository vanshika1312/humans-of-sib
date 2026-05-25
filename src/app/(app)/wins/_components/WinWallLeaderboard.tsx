import { Card, CardContent } from "@/components/ui/card";
import { cn, initials } from "@/lib/utils";
import { avatarGradientForId } from "@/lib/win-wall";
import type { WinWallData } from "../_lib/win-wall-data";

const MEDALS = ["🥇", "🥈", "🥉"];

export function WinWallLeaderboard({
  rows,
  monthLabel,
}: {
  rows: WinWallData["leaderboard"];
  monthLabel: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-500 flex items-center gap-2 mb-5">
          <span className="text-orange-500" aria-hidden>
            ■
          </span>
          Top performers — {monthLabel}
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-500 py-8 text-center">No points yet — celebrate the first win!</p>
        ) : (
          <ul className="space-y-4">
            {rows.map((row) => (
              <li key={row.user.id} className="flex items-center gap-3">
                <span className="w-8 text-center text-lg shrink-0" aria-hidden>
                  {row.rank <= 3 ? MEDALS[row.rank - 1] : (
                    <span className="text-sm font-bold text-ink-400">{row.rank}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white bg-gradient-to-br",
                    avatarGradientForId(row.user.id),
                  )}
                >
                  {initials(row.user.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-700">{row.user.name}</div>
                  <div className="text-xs text-ink-500">{row.user.department?.name ?? "—"}</div>
                  <div className="mt-2 h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full bg-gradient-to-r", avatarGradientForId(row.user.id))}
                      style={{ width: `${row.progress}%` }}
                    />
                  </div>
                </div>
                <div className="text-sm font-bold text-ink-700 tabular-nums shrink-0">
                  {row.points.toLocaleString("en-IN")} pts
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-6 text-center text-xs text-ink-400">
          Points are earned from wins celebrated, peer reactions, certifications, and targets met.
        </p>
      </CardContent>
    </Card>
  );
}
