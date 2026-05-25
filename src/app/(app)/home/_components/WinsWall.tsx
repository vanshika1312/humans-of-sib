import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, initials } from "@/lib/utils";
import { avatarGradientForId, formatRewardLabel, rewardBadgeTone } from "@/lib/win-wall";
import { relativeTime } from "@/lib/utils";
import { Trophy } from "lucide-react";

export async function WinsWall() {
  const recentWins = await prisma.win.findMany({
    take: 4,
    orderBy: { createdAt: "desc" },
    include: {
      user: { include: { department: true } },
      reactions: { select: { kind: true } },
    },
  });

  return (
    <Card>
      <CardHeader className="flex items-start justify-between flex-row">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-orange-500" /> Win Wall
          </CardTitle>
        </div>
        <Link href="/wins" className="text-xs font-medium text-sky-600 hover:underline">
          See all →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentWins.length === 0 && (
          <p className="text-sm text-ink-400">
            No wins yet.{" "}
            <Link href="/wins?tab=nominate" className="text-sky-600 hover:underline">
              Nominate someone
            </Link>
            .
          </p>
        )}
        {recentWins.map((w) => {
          const claps = w.reactions.filter((r) => r.kind === "CLAP").length;
          const fires = w.reactions.filter((r) => r.kind === "FIRE").length;
          return (
            <div key={w.id} className="flex gap-3 p-3 rounded-lg bg-ink-50/50">
              <span
                className={cn(
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white bg-gradient-to-br",
                  avatarGradientForId(w.userId),
                )}
              >
                {initials(w.user.name)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-ink-700">{w.user.name}</span>
                  <span className="text-xs text-ink-400 ml-auto">{relativeTime(w.createdAt)}</span>
                </div>
                <div className="mt-0.5 text-sm font-medium text-ink-700 line-clamp-1">{w.title}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {w.rewardType !== "NONE" && (
                    <span
                      className={cn(
                        "text-[10px] font-medium px-2 py-0.5 rounded-full",
                        rewardBadgeTone(w.rewardType),
                      )}
                    >
                      {formatRewardLabel(w)}
                    </span>
                  )}
                  <span className="text-xs text-ink-400">
                    {fires > 0 && `🔥 ${fires} `}
                    {claps > 0 && `👏 ${claps}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
