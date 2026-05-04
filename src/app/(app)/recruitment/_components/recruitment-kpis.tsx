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
        sub="When hiring data syncs live"
        tone="orange"
        placeholder
      />
      <MetricTile
        icon={<CalendarDays className="size-5" />}
        label="Hiring calendar"
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
  const toneClass = {
    sky: "text-sky-600 bg-sky-50",
    orange: "text-orange-600 bg-orange-50",
    sun: "text-sun-600 bg-sun-50",
    ink: "text-ink-600 bg-ink-100",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-ink-100 bg-white p-4 md:p-5 transition-colors",
        "hover:border-sky-200/80 hover:shadow-sm",
        placeholder && "opacity-[0.92]",
      )}
    >
      <div className={cn("size-10 rounded-xl inline-flex items-center justify-center", toneClass)}>{icon}</div>
      <div className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ink-400">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl md:text-3xl font-bold tabular-nums tracking-tight text-ink-800",
          placeholder && "animate-[pulse_2.8s_ease-in-out_infinite]",
        )}
      >
        {value}
      </div>
      <div className="mt-1.5 text-xs leading-snug text-ink-500">{sub}</div>
    </div>
  );
}
