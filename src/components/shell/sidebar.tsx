"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Compass,
  Trophy,
  MessageCircleHeart,
  Building2,
  CalendarClock,
  HeartPulse,
  GraduationCap,
  Target,
  Users,
  Gift,
  FileText,
  Cake,
  Sparkles,
  ClipboardPen,
  DoorOpen,
  Gem,
  Megaphone,
  Shield,
  Table2,
  UserSearch,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  Bot,
} from "lucide-react";

function buildNav(liaEnabled?: boolean) {
  return [
  { group: "Home", items: [
    { href: "/home", label: "Dashboard", icon: Home },
    ...(liaEnabled ? [{ href: "/lia", label: "LIA", icon: Bot }] : []),
    { href: "/journey", label: "My Journey", icon: Compass, comingSoon: true },
  ]},
  { group: "Community", items: [
    { href: "/people", label: "People", icon: Users },
    { href: "/wins", label: "Win Wall", icon: Trophy },
    { href: "/birthdays", label: "Celebrations", icon: Cake, comingSoon: true },
    { href: "/feedback/ceo", label: "Direct to CEO", icon: Megaphone },
    { href: "/feedback/dept", label: "Dept Feedback", icon: Building2 },
  ]},
  { group: "Work", items: [
    { href: "/attendance", label: "Attendance", icon: CalendarClock },
    { href: "/pulse", label: "Pulse", icon: HeartPulse },
    { href: "/okrs", label: "OKRs", icon: Target, comingSoon: true },
    { href: "/one-on-one", label: "1-on-1s", icon: Users, comingSoon: true },
    { href: "/trainings", label: "Trainings", icon: GraduationCap, comingSoon: true },
    { href: "/incentives", label: "Incentives", icon: Gift },
    {
      href: "/requisitions",
      label: "Job requisition",
      icon: ClipboardPen,
      roles: ["DEPT_HEAD", "MANAGER", "CEO", "ADMIN", "HR"],
    },
  ]},
  { group: "Me", items: [
    { href: "/my-tasks", label: "My Tasks", icon: ListTodo },
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/impact", label: "Learner Impact", icon: Gem, comingSoon: true },
    { href: "/onboarding", label: "Onboarding", icon: Sparkles, comingSoon: true },
    { href: "/offboarding", label: "Offboarding", icon: DoorOpen, comingSoon: true },
  ]},
  { group: "Say hi", items: [
    { href: "/feedback/ceo/new", label: "Message the CEO", icon: MessageCircleHeart },
  ]},
];
}

export function Sidebar({
  onNavigate,
  role,
  permissions,
  collapsed,
  onToggleCollapsed,
  liaEnabled,
}: {
  onNavigate?: () => void;
  role?: string;
  permissions?: string[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  liaEnabled?: boolean;
}) {
  const pathname = usePathname();
  const nav = buildNav(liaEnabled);
  const canSeeAdmin = (role && ["CEO", "ADMIN", "HR"].includes(role)) || (permissions ?? []).includes("ADMIN_PANEL");

  return (
    <nav className="h-full flex flex-col">
      <div className={cn("pb-4", collapsed ? "px-3 pt-5" : "px-5 pt-6")}>
        <div className="flex items-start justify-between gap-2">
          <Link href="/home" className="flex items-center gap-2" onClick={onNavigate} title="Home">
            <div className="size-8 rounded-md brand-gradient shrink-0" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-bold text-ink-700 leading-none">Humans of SIB</div>
                  {onToggleCollapsed && (
                    <button
                      type="button"
                      aria-expanded={!collapsed}
                      aria-label="Collapse menu"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleCollapsed();
                      }}
                      className="hidden md:inline-flex size-8 items-center justify-center rounded-md hover:bg-ink-50 text-ink-500 hover:text-ink-700"
                      title="Collapse menu"
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-ink-400 mt-1 uppercase tracking-wider">Skillinabox</div>
              </div>
            )}
          </Link>

          {onToggleCollapsed && collapsed && (
            <button
              type="button"
              aria-expanded={!collapsed}
              aria-label="Expand navigation"
              onClick={onToggleCollapsed}
              className="md:inline-flex size-8 items-center justify-center rounded-md hover:bg-ink-50 text-ink-500 hover:text-ink-700"
              title="Expand menu"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-5">
        {nav.map((section) => (
          <div key={section.group}>
            {!collapsed && (
              <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-300 mb-1.5">
                {section.group}
              </div>
            )}
            <ul className={cn("space-y-0.5", collapsed && "flex flex-col items-center")}>
              {section.items
                .filter((item) => {
                  const restricted = (item as { roles?: readonly string[] }).roles;
                  if (restricted?.length) return Boolean(role && restricted.includes(role));
                  return true;
                })
                .map(({ href, label, icon: Icon, comingSoon }) => {
                  const active =
                    pathname === href ||
                    (href !== "/home" && href !== "/requisitions" && pathname.startsWith(href)) ||
                    (href === "/requisitions" && pathname.startsWith("/requisitions"));
                  if (comingSoon) {
                    return (
                      <li key={href} className={cn(collapsed && "w-full flex justify-center")}>
                        <div
                          title={label}
                          className={cn(
                            "flex items-center justify-between gap-2.5 rounded-md text-sm font-medium text-ink-300 cursor-not-allowed select-none",
                            collapsed ? "px-2 py-2 justify-center" : "px-4 py-3 w-full",
                          )}
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon className="size-4 shrink-0" />
                            {!collapsed && label}
                          </span>
                          {!collapsed && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider bg-ink-100 text-ink-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              Soon
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li key={href} className={cn(collapsed && "w-full flex justify-center")}>
                      <Link
                        href={href}
                        title={collapsed ? label : undefined}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                          collapsed ? "px-2 py-2 justify-center" : "px-4 py-3 w-full",
                          active ? "bg-sky-50 text-sky-700" : "text-ink-500 hover:text-ink-700 hover:bg-ink-50",
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        {!collapsed && label}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {canSeeAdmin && (
          <div className={cn("pb-4 border-t border-ink-100 pt-4", collapsed ? "px-0" : "px-3")}>
            {!collapsed && (
              <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-300 mb-1.5">
                Admin
              </div>
            )}
            <ul className={cn("space-y-0.5", collapsed && "flex flex-col items-center")}>
              <li className={cn(collapsed && "w-full flex justify-center")}>
                <Link
                  href="/admin"
                  title={collapsed ? "Manage Team" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                    collapsed ? "px-2 py-2 justify-center" : "px-4 py-3 w-full",
                    pathname === "/admin" || pathname.startsWith("/admin/team")
                      ? "bg-sky-50 text-sky-700"
                      : "text-ink-500 hover:text-ink-700 hover:bg-ink-50",
                  )}
                >
                  <Shield className="size-4 shrink-0" />
                  {!collapsed && "Manage Team"}
                </Link>
              </li>
              <li className={cn(collapsed && "w-full flex justify-center")}>
                <Link
                  href="/admin/attendance-report"
                  title={collapsed ? "Attendance report" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                    collapsed ? "px-2 py-2 justify-center" : "px-4 py-3 w-full",
                    pathname.startsWith("/admin/attendance-report")
                      ? "bg-sky-50 text-sky-700"
                      : "text-ink-500 hover:text-ink-700 hover:bg-ink-50",
                  )}
                >
                  <Table2 className="size-4 shrink-0" />
                  {!collapsed && "Attendance report"}
                </Link>
              </li>
              <li className={cn(collapsed && "w-full flex justify-center")}>
                <Link
                  href="/admin/pulse"
                  title={collapsed ? "Weekly Pulse" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                    collapsed ? "px-2 py-2 justify-center" : "px-4 py-3 w-full",
                    pathname.startsWith("/admin/pulse")
                      ? "bg-sky-50 text-sky-700"
                      : "text-ink-500 hover:text-ink-700 hover:bg-ink-50",
                  )}
                >
                  <HeartPulse className="size-4 shrink-0" />
                  {!collapsed && "Weekly Pulse"}
                </Link>
              </li>
              <li className={cn(collapsed && "w-full flex justify-center")}>
                <Link
                  href="/hiring"
                  title={collapsed ? "Hiring" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
                    collapsed ? "px-2 py-2 justify-center" : "px-4 py-3 w-full",
                    pathname === "/hiring" || pathname.startsWith("/hiring/")
                      ? "bg-sky-50 text-sky-700"
                      : "text-ink-500 hover:text-ink-700 hover:bg-ink-50",
                  )}
                >
                  <UserSearch className="size-4 shrink-0" />
                  {!collapsed && "Hiring"}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
