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
  DoorOpen,
  Gem,
  Megaphone,
  Shield,
} from "lucide-react";

const nav = [
  { group: "Home", items: [
    { href: "/home", label: "Dashboard", icon: Home, comingSoon: true },
    { href: "/journey", label: "My Journey", icon: Compass, comingSoon: true },
  ]},
  { group: "Community", items: [
    { href: "/people", label: "People", icon: Users, comingSoon: true },
    { href: "/wins", label: "Wins Wall", icon: Trophy, comingSoon: true },
    { href: "/birthdays", label: "Celebrations", icon: Cake, comingSoon: true },
    { href: "/feedback/ceo", label: "Direct to CEO", icon: Megaphone, comingSoon: true },
    { href: "/feedback/dept", label: "Dept Feedback", icon: Building2, comingSoon: true },
  ]},
  { group: "Work", items: [
    { href: "/attendance", label: "Attendance", icon: CalendarClock },
    { href: "/pulse", label: "Pulse", icon: HeartPulse, comingSoon: true },
    { href: "/okrs", label: "OKRs", icon: Target, comingSoon: true },
    { href: "/one-on-one", label: "1-on-1s", icon: Users, comingSoon: true },
    { href: "/trainings", label: "Trainings", icon: GraduationCap, comingSoon: true },
    { href: "/incentives", label: "Incentives", icon: Gift },
  ]},
  { group: "Me", items: [
    { href: "/documents", label: "Documents", icon: FileText, comingSoon: true },
    { href: "/impact", label: "Learner Impact", icon: Gem, comingSoon: true },
    { href: "/onboarding", label: "Onboarding", icon: Sparkles, comingSoon: true },
    { href: "/offboarding", label: "Offboarding", icon: DoorOpen, comingSoon: true },
  ]},
  { group: "Say hi", items: [
    { href: "/feedback/ceo/new", label: "Message the CEO", icon: MessageCircleHeart, comingSoon: true },
  ]},
];

export function Sidebar({ onNavigate, role }: { onNavigate?: () => void; role?: string }) {
  const pathname = usePathname();

  return (
    <nav className="h-full flex flex-col">
      <div className="px-5 pt-6 pb-4">
        <Link href="/home" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="size-8 rounded-md brand-gradient" />
          <div>
            <div className="font-bold text-ink-700 leading-none">Humans of SIB</div>
            <div className="text-[10px] text-ink-400 mt-1 uppercase tracking-wider">
              Skillinabox
            </div>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-6 space-y-5">
        {nav.map((section) => (
          <div key={section.group}>
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-300 mb-1.5">
              {section.group}
            </div>
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, comingSoon }) => {
                const active = pathname === href || (href !== "/home" && pathname.startsWith(href));
                if (comingSoon) {
                  return (
                    <li key={href}>
                      <div
                        className="flex items-center justify-between gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-ink-300 cursor-not-allowed select-none"
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="size-4" />
                          {label}
                        </span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider bg-ink-100 text-ink-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          Soon
                        </span>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        active
                          ? "bg-sky-50 text-sky-700"
                          : "text-ink-500 hover:text-ink-700 hover:bg-ink-50",
                      )}
                    >
                      <Icon className="size-4" />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      {role && ["CEO", "ADMIN", "HR"].includes(role) && (
          <div className="px-3 pb-4 border-t border-ink-100 pt-4">
            <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-ink-300 mb-1.5">
              Admin
            </div>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href="/admin"
                  onClick={onNavigate}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-ink-500 hover:text-ink-700 hover:bg-ink-50"
                >
                  <Shield className="size-4" />
                  Manage Team
                </Link>
              </li>
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}
