import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDate, initials } from "@/lib/utils";
import {
  avatarGradientForId,
  formatRewardLabel,
  rewardBadgeTone,
  WIN_CATEGORY_LABEL,
  WIN_CATEGORY_TONE,
} from "@/lib/win-wall";
import { WinReactionButtons } from "./WinReactionButtons";
import type { WinWallData } from "../_lib/win-wall-data";
import type { WinCategory, WinReactionKind } from "@prisma/client";

function reactionCounts(reactions: { kind: WinReactionKind }[]) {
  const counts: Partial<Record<WinReactionKind, number>> = {};
  for (const r of reactions) {
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  }
  return counts;
}

export function WinWallRecentWins({
  wins,
  viewerId,
}: {
  wins: WinWallData["recentWins"];
  viewerId: string;
}) {
  return (
    <section>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-500 flex items-center gap-2 mb-4">
        <span className="text-orange-500" aria-hidden>
          ■
        </span>
        Recent wins
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        {wins.map((w) => {
          const mine = w.reactions.filter((r) => r.userId === viewerId).map((r) => r.kind);
          const reward = formatRewardLabel(w);
          return (
            <Card key={w.id} className="border-ink-200/90">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white bg-gradient-to-br",
                      avatarGradientForId(w.userId),
                    )}
                  >
                    {initials(w.user.name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-ink-700">{w.user.name}</div>
                        <div className="text-xs text-ink-500">
                          {[w.user.title, w.user.department?.name].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <time className="text-xs text-ink-400 shrink-0" dateTime={w.createdAt.toISOString()}>
                        {formatDate(w.createdAt, { day: "numeric", month: "short" })}
                      </time>
                    </div>
                    {w.category && (
                      <span
                        className={cn(
                          "inline-block mt-2 text-[11px] font-medium px-2 py-0.5 rounded-full border",
                          WIN_CATEGORY_TONE[w.category as WinCategory],
                        )}
                      >
                        {WIN_CATEGORY_LABEL[w.category as WinCategory]}
                      </span>
                    )}
                    <h3 className="mt-2 font-semibold text-ink-800">{w.title}</h3>
                    {w.description && (
                      <p className="mt-1 text-sm text-ink-500 line-clamp-3">{w.description}</p>
                    )}
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                      {w.rewardType !== "NONE" && (
                        <span
                          className={cn(
                            "text-[11px] font-medium px-2.5 py-1 rounded-full",
                            rewardBadgeTone(w.rewardType),
                          )}
                        >
                          {reward}
                        </span>
                      )}
                      <WinReactionButtons
                        winId={w.id}
                        counts={reactionCounts(w.reactions)}
                        mine={mine}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
