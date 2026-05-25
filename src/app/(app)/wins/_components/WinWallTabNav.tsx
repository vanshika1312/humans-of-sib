import Link from "next/link";
import { cn } from "@/lib/utils";
import { WIN_WALL_TABS, type WinWallTab } from "@/lib/win-wall-access";

export function WinWallTabNav({ active, adminAction }: { active: WinWallTab; adminAction?: string }) {
  const extra = adminAction ? `&action=${adminAction}` : "";

  return (
    <nav
      className="flex flex-wrap gap-1 p-1 rounded-xl border border-ink-200 bg-white/80"
      aria-label="Win Wall sections"
    >
      {WIN_WALL_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/wins?tab=${tab.id}${extra}`}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            active === tab.id
              ? "bg-ink-700 text-white shadow-sm"
              : "text-ink-600 hover:bg-ink-50",
          )}
        >
          <span aria-hidden>{tab.emoji}</span>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
