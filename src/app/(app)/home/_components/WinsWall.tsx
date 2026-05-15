import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";
import { Trophy } from "lucide-react";

export async function WinsWall() {
  const recentWins = await prisma.win.findMany({
    take: 4,
    orderBy: { createdAt: "desc" },
    include: { user: { include: { department: true } }, _count: { select: { claps: true } } },
  });

  return (
    <Card>
      <CardHeader className="flex items-start justify-between flex-row">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-orange-500" /> Wins Wall
          </CardTitle>
        </div>
        <Link href="/wins" className="text-xs font-medium text-sky-600 hover:underline">
          See all →
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentWins.length === 0 && (
          <p className="text-sm text-ink-400">
            No wins yet. Be the first to{" "}
            <Link href="/wins" className="text-sky-600 hover:underline">
              share one
            </Link>
            .
          </p>
        )}
        {recentWins.map((w) => (
          <div key={w.id} className="flex gap-3 p-3 rounded-lg bg-ink-50/50">
            <Avatar src={w.user.image} name={w.user.name} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-ink-700">{w.user.name}</span>
                {w.user.department && <Badge tone="sky">{w.user.department.name}</Badge>}
                <span className="text-xs text-ink-400 ml-auto">{relativeTime(w.createdAt)}</span>
              </div>
              <div className="mt-0.5 text-sm font-medium text-ink-700">{w.title}</div>
              {w.description && <p className="text-sm text-ink-500 mt-0.5 line-clamp-2">{w.description}</p>}
              <div className="mt-1.5 text-xs text-ink-400">👏 {w._count.claps}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
