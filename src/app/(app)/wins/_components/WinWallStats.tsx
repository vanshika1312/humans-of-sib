import { Card, CardContent } from "@/components/ui/card";

const items = [
  { key: "winsCelebrated", label: "Wins celebrated", emoji: "🎉" },
  { key: "membersRewarded", label: "Members rewarded", emoji: "👑" },
  { key: "cashLabel", label: "Cash rewards given", emoji: "💰" },
  { key: "certsIssued", label: "Certificates issued", emoji: "📜" },
] as const;

export function WinWallStats({
  stats,
}: {
  stats: {
    winsCelebrated: number;
    membersRewarded: number;
    cashLabel: string;
    certsIssued: number;
  };
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item) => {
        const value =
          item.key === "cashLabel"
            ? stats.cashLabel
            : String(stats[item.key as "winsCelebrated" | "membersRewarded" | "certsIssued"]);
        return (
          <Card key={item.key} className="border-ink-200/80">
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl" aria-hidden>
                {item.emoji}
              </div>
              <div className="mt-2 text-2xl font-bold text-ink-700 tabular-nums">{value}</div>
              <div className="text-xs text-ink-500 mt-0.5">{item.label}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
