import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn, formatDate } from "@/lib/utils";
import { Building2, CalendarClock, ClipboardList, FileSpreadsheet, KeyRound, UserPlus } from "lucide-react";

type RecentUser = {
  id: string;
  name: string | null;
  image: string | null;
  email: string;
  joinedAt: Date;
  department: { name: string; emoji: string | null } | null;
};

export function RecruitmentSidebar({ recent }: { recent: RecentUser[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-base font-semibold text-ink-700 tracking-tight">Recent joiners</h3>
          <p className="text-xs text-ink-400 mt-1">Latest people onboarded onto the roster.</p>
        </div>
        <div className="divide-y divide-ink-100">
          {recent.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-ink-400 bg-ink-50/30">
              No recent joiners for this filter.
            </div>
          ) : (
            recent.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-sky-50/40 transition-colors">
                <Avatar src={u.image} name={u.name} size="sm" className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink-700 text-sm truncate">{u.name || u.email}</div>
                  <div className="text-[11px] text-ink-400 flex items-center gap-1 truncate">
                    {u.department ? (
                      <>
                        <span className="shrink-0">{u.department.emoji}</span>
                        <span className="truncate">{u.department.name}</span>
                        <span aria-hidden className="text-ink-200">
                          ·
                        </span>
                      </>
                    ) : (
                      <>
                        <Building2 className="size-3 shrink-0 text-ink-300" aria-hidden />
                        <span>Unassigned</span>
                        <span aria-hidden className="text-ink-200">
                          ·
                        </span>
                      </>
                    )}
                    <span className="shrink-0 whitespace-nowrap">{formatDate(u.joinedAt)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-4 border-t border-ink-100 bg-ink-50/40">
          <Link
            href="/admin"
            className={cn(
              "inline-flex w-full h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors border border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
            )}
          >
            Browse full roster
          </Link>
        </div>
      </div>

      <Shortcuts />
    </div>
  );
}

function Shortcuts() {
  const items = [
    { href: "/recruitment#daily-report", label: "Daily report", Icon: FileSpreadsheet, desc: "Pick or type recruiter & location" },
    { href: "/recruitment/access", label: "Dashboard access", Icon: KeyRound, desc: "Admin vs HR workspace roles" },
    { href: "/admin/team/new", label: "Create profile", Icon: UserPlus, desc: "Add someone hired off-cycle" },
    { href: "/admin", label: "Team & access", Icon: ClipboardList, desc: "Titles, dept, payroll flags" },
    { href: "/attendance", label: "Attendance", Icon: CalendarClock, desc: "First-week check-ins" },
  ];
  return (
    <div className="rounded-2xl border border-ink-100 bg-gradient-to-b from-white to-ink-50/50 p-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="rounded-[14px] ring-1 ring-ink-100/80 bg-white/95 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Shortcuts</div>
        <div className="mt-3 space-y-1.5">
          {items.map(({ href, label, Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className={[
                "flex items-start gap-3 rounded-xl px-3 py-2.5 -mx-2",
                "text-ink-600 hover:bg-sky-50 hover:text-sky-800 transition-colors",
              ].join(" ")}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-orange-50 text-sky-700 ring-1 ring-sky-200/70">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="font-medium text-sm block leading-tight">{label}</span>
                <span className="text-xs text-ink-400 mt-0.5 block leading-snug">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
