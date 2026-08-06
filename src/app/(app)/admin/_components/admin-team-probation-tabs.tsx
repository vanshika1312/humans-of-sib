import Link from "next/link";
import { cn } from "@/lib/utils";

export type AdminTeamProbationFilter = "all" | "on" | "confirmed";

const TABS: { id: AdminTeamProbationFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "on", label: "On probation" },
  { id: "confirmed", label: "Confirmed" },
];

export function parseAdminTeamProbationFilter(raw?: string): AdminTeamProbationFilter {
  if (raw === "on" || raw === "confirmed") return raw;
  return "all";
}

export function AdminTeamProbationTabs({
  active,
  counts,
  q,
}: {
  active: AdminTeamProbationFilter;
  counts: Record<AdminTeamProbationFilter, number>;
  q?: string;
}) {
  const tabHref = (tabId: AdminTeamProbationFilter) => {
    const params = new URLSearchParams();
    if (tabId !== "all") params.set("probation", tabId);
    if (q) params.set("q", q);
    const tail = params.toString();
    return tail ? `/admin?${tail}` : "/admin";
  };

  return (
    <nav
      className="flex flex-wrap gap-1 p-1 rounded-xl border border-ink-200 bg-ink-50/50"
      aria-label="Probation filter"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tabHref(tab.id)}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
            active === tab.id
              ? "bg-white text-ink-800 shadow-sm border border-ink-200"
              : "text-ink-600 hover:bg-white/80",
          )}
        >
          {tab.label}
          <span className="text-xs text-ink-400 tabular-nums">({counts[tab.id]})</span>
        </Link>
      ))}
    </nav>
  );
}
