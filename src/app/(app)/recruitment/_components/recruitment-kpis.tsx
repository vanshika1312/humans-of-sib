import { Briefcase, KanbanSquare, CalendarDays, UserPlus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function RecruitmentKpis({
  recentJoins,
  activeHeadcount,
}: {
  recentJoins: number;
  activeHeadcount: number;
}) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
      <MetricTile
        icon={<Briefcase className="size-5" />}
        label="Open roles"
        value="—"
        sub="Connect requisitions next"
        tone="sky"
        placeholder
      />
      <MetricTile
        icon={<KanbanSquare className="size-5" />}
        label="Pipeline"
        value="—"
        sub="Stages when ATS syncs"
        tone="orange"
        placeholder
      />
      <MetricTile
        icon={<CalendarDays className="size-5" />}
        label="Interview load"
        value="—"
        sub="Rolling 7 days"
        tone="sun"
        placeholder
      />
      <MetricTile
        icon={<UserPlus className="size-5" />}
        label="New joins"
        value={`${recentJoins}`}
        sub={
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="size-3 shrink-0" aria-hidden /> {activeHeadcount} active org-wide
          </span>
        }
        tone="ink"
      />
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  sub,
  tone,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: React.ReactNode;
  tone: "sky" | "orange" | "sun" | "ink";
  placeholder?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl p-4 md:p-5 transition-all duration-200",
        "hover:shadow-xl hover:-translate-y-0.5",
        tone === "sky" &&
          "bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-[0_12px_32px_-8px_rgb(41_182_232/35%)]",
        tone === "orange" &&
          "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_12px_32px_-8px_rgb(242_101_34/38%)]",
        tone === "sun" &&
          "bg-gradient-to-br from-[#ffd65a] to-[#e6b125] text-ink-800 shadow-[0_12px_32px_-8px_rgb(255_201_60/38%)]",
        tone === "ink" &&
          "bg-gradient-to-br from-ink-600 to-ink-700 text-white shadow-[0_12px_32px_-8px_rgb(45_45_45/38%)]",
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_40%,rgba(255,255,255,0.08)_50%,transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div
        className={cn(
          "size-10 rounded-xl inline-flex items-center justify-center backdrop-blur-sm",
          tone === "sun" ? "bg-ink-900/10 text-ink-800" : "bg-white/20 text-white",
        )}
      >
        {icon}
      </div>
      <div
        className={cn(
          "mt-4 text-[11px] md:text-xs font-semibold uppercase tracking-[0.12em]",
          tone === "sun" ? "text-ink-600/85" : "text-white/80",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl md:text-3xl font-bold tabular-nums tracking-tight",
          tone === "sun" ? "text-ink-900" : "text-white",
          placeholder && "opacity-95 animate-[pulse_2.8s_ease-in-out_infinite]",
        )}
      >
        {value}
      </div>
      <div className={cn("mt-1.5 text-xs leading-snug", tone === "sun" ? "text-ink-700/90" : "text-white/80")}>{sub}</div>
    </div>
  );
}
