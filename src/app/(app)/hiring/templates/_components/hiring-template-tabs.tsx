"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type HiringTemplateTab = "job" | "questionnaire" | "email";

const TABS: { id: HiringTemplateTab; label: string }[] = [
  { id: "job", label: "Job profiles" },
  { id: "questionnaire", label: "Questionnaires" },
  { id: "email", label: "Emails" },
];

export function HiringTemplateTabs({ active }: { active: HiringTemplateTab }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-1">
      {TABS.map((tab) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set("tab", tab.id);
        params.delete("error");
        params.delete("saved");
        params.delete("removed");
        const href = `${pathname}?${params.toString()}`;
        return (
          <Link
            key={tab.id}
            href={href}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active === tab.id
                ? "bg-sky-100 text-sky-900"
                : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
