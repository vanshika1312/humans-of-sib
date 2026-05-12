"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const LINKS: { href: string; label: string; isActive: (pathname: string) => boolean }[] = [
  { href: "/hiring", label: "Overview", isActive: (p) => p === "/hiring" },
  { href: "/hiring/jobs", label: "Job openings", isActive: (p) => p.startsWith("/hiring/jobs") },
  {
    href: "/hiring/applications",
    label: "Applications",
    isActive: (p) => p === "/hiring/applications" || p.startsWith("/hiring/applications/"),
  },
  {
    href: "/hiring/pipeline",
    label: "Pipeline",
    isActive: (p) => p === "/hiring/pipeline",
  },
  {
    href: "/hiring/pipeline-stages",
    label: "Stages",
    isActive: (p) => p.startsWith("/hiring/pipeline-stages"),
  },
  {
    href: "/hiring/templates",
    label: "Templates",
    isActive: (p) => p.startsWith("/hiring/templates") || p.startsWith("/hiring/interview-templates"),
  },
];

export function HiringSubnav() {
  const pathname = usePathname();
  const applicationsActive =
    pathname === "/hiring/applications" || pathname.startsWith("/hiring/applications/");

  return (
    <nav className="-mx-4 md:-mx-0 px-4 md:px-0 pb-px">
      <div className="flex flex-wrap items-center justify-between gap-3 gap-y-2">
        <div className="overflow-x-auto pb-px min-w-0 flex-1">
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
        </div>
        {applicationsActive ? (
          <Link href="/hiring/candidates/new" className="shrink-0">
            <Button type="button" variant="accent" size="md" className="whitespace-nowrap">
              Add candidate
            </Button>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
