import { cn, initials } from "@/lib/utils";
import { avatarGradientForId, formatRewardLabel } from "@/lib/win-wall";
import { WinReactionButtons } from "./WinReactionButtons";
import type { WinWallData } from "../_lib/win-wall-data";
import type { WinReactionKind } from "@prisma/client";

function reactionCounts(reactions: { kind: WinReactionKind }[]) {
  const counts: Partial<Record<WinReactionKind, number>> = {};
  for (const r of reactions) {
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
  }
  return counts;
}

export function WinWallSpotlight({
  win,
  viewerId,
  monthLabel,
}: {
  win: NonNullable<WinWallData["spotlightWin"]>;
  viewerId: string;
  monthLabel: string;
}) {
  const dept = win.user.department?.name;
  const roleLine = [win.user.title, dept].filter(Boolean).join(" · ");
  const reward = formatRewardLabel(win);
  const mine = win.reactions.filter((r) => r.userId === viewerId).map((r) => r.kind);

  return (
    <section className="rounded-2xl overflow-hidden border border-amber-200/80 bg-gradient-to-br from-amber-100 via-orange-50 to-amber-50">
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row gap-5 lg:items-center">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-900/80 flex items-center gap-2">
            <span className="text-orange-600" aria-hidden>
              ■
            </span>
            Spotlight of the month
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span
              className={cn(
                "inline-flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white bg-gradient-to-br ring-2 ring-white/80",
                avatarGradientForId(win.userId),
              )}
            >
              {initials(win.user.name)}
            </span>
            <div>
              <div className="text-xl font-bold text-ink-800">{win.user.name}</div>
              {roleLine && <div className="text-sm text-ink-600">{roleLine}</div>}
            </div>
          </div>
          <p className="mt-4 inline-flex px-3 py-1.5 rounded-lg bg-white/70 text-sm font-semibold text-ink-800 border border-amber-200/60">
            {win.title}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {win.rewardType !== "NONE" && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/80 text-amber-900 border border-amber-200">
                {reward}
              </span>
            )}
            {win.certificate && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-violet-100 text-violet-800">
                Certificate issued
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-500">{monthLabel}</p>
        </div>
        <WinReactionButtons
          winId={win.id}
          counts={reactionCounts(win.reactions)}
          mine={mine}
          layout="column"
        />
      </div>
    </section>
  );
}
