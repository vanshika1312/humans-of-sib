import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";
import { Rocket, Sparkles, UserPlus } from "lucide-react";

export function RecruitmentHero({
  firstName,
  recentJoins,
  activeHeadcount,
}: {
  firstName: string;
  recentJoins: number;
  activeHeadcount: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl brand-gradient p-6 md:p-8 text-white shadow-[0_24px_50px_-20px_rgb(41_182_232/35%)]">
      <div className="absolute inset-0 confetti opacity-25" />
      <div className="absolute -top-24 -right-24 size-72 rounded-full bg-white/12 blur-3xl" />
      <div className="absolute -bottom-16 left-1/4 size-48 rounded-full bg-orange-400/25 blur-2xl" />

      <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/95 ring-1 ring-white/25">
            <Sparkles className="size-3.5" />
            Hiring workspace
          </div>
          <div>
            <p className="text-sm text-white/85">{formatDate(new Date(), { weekday: "long", month: "short", day: "numeric" })}</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-0.5">
              Let&apos;s build the team, {firstName}
            </h1>
            <p className="mt-2 text-sm md:text-[15px] text-white/90 max-w-xl leading-relaxed">
              Pipeline and requisitions stay in one glanceable view. Candidate tracking lands next — for now live org signals keep you anchored.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Chip label="Joins · 30d" value={`${recentJoins}`} />
            <Chip label="Active headcount" value={`${activeHeadcount}`} />
            <Chip label="ATS" value="Soon" muted />
          </div>
        </div>

        <div className="flex flex-col gap-3 shrink-0 lg:items-end">
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              href="/admin/team/new"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg px-6 h-12 text-base font-medium transition-colors shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                "bg-white text-orange-600 hover:bg-white/95 active:bg-white/90",
              )}
            >
              <UserPlus className="size-4" />
              Add hire
            </Link>
            <Link
              href="/admin"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg px-6 h-12 text-base font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                "bg-white/15 text-white ring-1 ring-white/35 hover:bg-white/25 backdrop-blur-sm",
              )}
            >
              <Rocket className="size-4" />
              Team roster
            </Link>
          </div>
          <Link
            href="/recruitment/access"
            className="text-sm font-medium text-white/90 hover:text-white underline-offset-4 hover:underline lg:text-right"
          >
            Who can access this dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <span
      className={
        muted
          ? "inline-flex items-baseline gap-1.5 rounded-lg bg-black/15 px-2.5 py-1 ring-1 ring-white/15"
          : "inline-flex items-baseline gap-1.5 rounded-lg bg-black/10 px-2.5 py-1 ring-1 ring-white/20"
      }
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/65">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </span>
  );
}
