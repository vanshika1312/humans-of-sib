import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate, initials } from "@/lib/utils";
import { avatarGradientForId, formatRewardLabel, rewardBadgeTone } from "@/lib/win-wall";
import type { WinWallData } from "../_lib/win-wall-data";

export function WinWallHistory({ wins, year }: { wins: WinWallData["historyWins"]; year: number }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-500 flex items-center gap-2 mb-5">
          <span className="text-orange-500" aria-hidden>
            ■
          </span>
          All wins — {year}
        </h2>
        {wins.length === 0 ? (
          <p className="text-sm text-ink-500 py-6 text-center">No wins recorded this year yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {wins.map((w) => {
              const subtitle = [w.title, w.user.department?.name].filter(Boolean).join(" · ");
              const reward = formatRewardLabel(w);
              return (
                <li key={w.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                  <span
                    className={cn(
                      "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white bg-gradient-to-br",
                      avatarGradientForId(w.userId),
                    )}
                  >
                    {initials(w.user.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink-700">{w.user.name}</div>
                    <div className="text-sm text-ink-500 truncate">{subtitle}</div>
                  </div>
                  {w.rewardType !== "NONE" && (
                    <span
                      className={cn(
                        "text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 hidden sm:inline",
                        rewardBadgeTone(w.rewardType),
                      )}
                    >
                      {reward}
                    </span>
                  )}
                  <time
                    className="text-xs text-ink-400 shrink-0 tabular-nums"
                    dateTime={w.createdAt.toISOString()}
                  >
                    {formatDate(w.createdAt, { day: "numeric", month: "short" })}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
