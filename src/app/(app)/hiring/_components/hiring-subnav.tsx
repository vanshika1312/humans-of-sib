"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; isActive: (pathname: string) => boolean }[] = [
  { href: "/hiring", label: "Overview", isActive: (p) => p === "/hiring" },
  { href: "/hiring/jobs", label: "Job openings", isActive: (p) => p.startsWith("/hiring/jobs") },
  { href: "/hiring/candidates", label: "Candidates", isActive: (p) => p.startsWith("/hiring/candidates") },
  {
    href: "/hiring/pipeline",
    label: "Pipeline",
    isActive: (p) => p === "/hiring/pipeline",
  },
];

export function HiringSubnav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 md:-mx-0 px-4 md:px-0 overflow-x-auto pb-px">
      <div className="flex gap-1 p-1 bg-ink-100/70 rounded-xl w-fit min-w-min border border-ink-100">
        {LINKS.map(({ href, label, isActive }) => {
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
    </nav>
  );
}
