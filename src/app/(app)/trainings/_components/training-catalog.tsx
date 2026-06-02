import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { displayName } from "@/lib/user-display-name";
import type { loadTrainingLeaderboard } from "@/lib/training-data";

export function TrainingLeaderboard({
  entries,
  year,
}: {
  entries: Awaited<ReturnType<typeof loadTrainingLeaderboard>>;
  year: number;
}) {
  if (entries.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardContent className="pt-5">
        <h3 className="font-semibold text-ink-700 mb-3">Learning leaderboard · {year}</h3>
        <div className="space-y-2">
          {entries.map((row) => {
            const name = displayName(row.user);
            return (
              <div key={row.user.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-ink-400 w-5">#{row.rank}</span>
                <Avatar src={row.user.image} name={name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-700 truncate">{name}</div>
                  {row.user.department?.name ? (
                    <div className="text-xs text-ink-400 truncate">{row.user.department.name}</div>
                  ) : null}
                </div>
                <Badge tone="sky">{row.points} pts</Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function TrainingCatalogCard({
  training,
  enrollmentStatus,
}: {
  training: {
    id: string;
    title: string;
    description: string | null;
    author: string | null;
    provider: string | null;
    durationMin: number | null;
    pointsAwarded: number;
    type: string;
  };
  enrollmentStatus?: string;
}) {
  const done = enrollmentStatus === "COMPLETED";
  const inProgress = enrollmentStatus === "IN_PROGRESS";

  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="h-20 brand-gradient relative">
        <div className="absolute inset-0 bg-white/60" />
        <div className="relative p-3 flex flex-wrap gap-2">
          <Badge tone="sky">{training.pointsAwarded} pts</Badge>
          {training.durationMin ? <Badge tone="ink">{training.durationMin} min</Badge> : null}
          {done ? <Badge tone="green">Done</Badge> : inProgress ? <Badge tone="orange">In progress</Badge> : null}
        </div>
      </div>
      <CardContent className="pt-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-ink-700">{training.title}</h3>
        {training.author ? <p className="text-xs text-ink-400 mt-0.5">by {training.author}</p> : null}
        {training.provider ? <p className="text-xs text-ink-400 mt-0.5">{training.provider}</p> : null}
        {training.description ? (
          <p className="text-sm text-ink-500 mt-2 line-clamp-2 flex-1">{training.description}</p>
        ) : (
          <div className="flex-1" />
        )}
        <Link href={`/trainings/${training.id}`} className="mt-4 block">
          <Button size="sm" variant="accent" className="w-full">
            {done ? "Review" : inProgress ? "Continue" : "Start"} →
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
