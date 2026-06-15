"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
};

const BASE_TABS: Tab[] = [
  { href: "/work", label: "Daily Work", isActive: (p) => p === "/work" },
  {
    href: "/work/team",
    label: "Team tasks",
    isActive: (p) => p === "/work/team" || p.startsWith("/work/team/"),
  },
  {
    href: "/work/okrs",
    label: "Dept OKRs",
    isActive: (p) => p === "/work/okrs" || p.startsWith("/work/okrs/"),
  },
  {
    href: "/work/personal",
    label: "Personal OKRs",
    isActive: (p) => p === "/work/personal" || p.startsWith("/work/personal/"),
  },
];

export function OkrSectionTabs({ showTeamTab }: { showTeamTab: boolean }) {
  const pathname = usePathname();
  const tabs = showTeamTab ? BASE_TABS : BASE_TABS.filter((t) => t.href !== "/work/team");

  return (
    <nav className="-mx-4 md:mx-0 px-4 md:px-0" aria-label="OKR sections">
      <div className="overflow-x-auto pb-px">
        <div className="flex gap-1 p-1 bg-ink-100/70 rounded-xl w-fit min-w-min border border-ink-100">
          {tabs.map(({ href, label, isActive }) => {
            const active = isActive(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-white text-ink-800 shadow-sm ring-1 ring-ink-100"
                    : "text-ink-500 hover:text-ink-700 hover:bg-white/50",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
