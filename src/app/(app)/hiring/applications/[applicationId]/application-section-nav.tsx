"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react";

const STORAGE_KEY = "hosib-application-section-nav-expanded";

const LINKS = [
  { href: "#section-summary", label: "Summary" },
  { href: "#section-details", label: "Application details" },
  { href: "#section-move-delete", label: "Move / delete" },
  { href: "#section-attachments", label: "Attachments" },
  { href: "#section-tags", label: "Tags" },
  { href: "#section-reviews", label: "Interview feedback" },
  { href: "#section-templates", label: "Questionnaires" },
  { href: "#section-submissions", label: "Hiring manager" },
  { href: "#section-emails", label: "Emails" },
] as const;

export function HiringApplicationSectionNav({
  overviewPath,
}: {
  /** Application overview URL (no timeline tab) so section anchors resolve. */
  overviewPath: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      queueMicrotask(() => {
        if (raw === "0") setExpanded(false);
        setReady(true);
      });
    } catch {
      queueMicrotask(() => setReady(true));
    }
  }, []);

  function toggle(next: boolean) {
    setExpanded(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={cn("rounded-xl border border-ink-100 bg-ink-50/50 shrink-0", ready ? "" : "opacity-0")}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => toggle(!expanded)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-ink-600 hover:bg-ink-100/80 rounded-xl transition-colors"
      >
        <span className="flex items-center gap-2">
          {expanded ? <PanelLeftClose className="size-4 shrink-0 text-ink-400" /> : <PanelLeft className="size-4 shrink-0 text-ink-400" />}
          <span>{expanded ? "On this page" : "Sections"}</span>
        </span>
        {expanded ? <ChevronDown className="size-4 text-ink-400 shrink-0" /> : <ChevronRight className="size-4 text-ink-400 shrink-0" />}
      </button>
      {expanded ? (
        <nav className="border-t border-ink-100 px-2 pb-2 pt-1">
          <ul className="space-y-0.5">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={`${overviewPath}${l.href}`}
                  className="block rounded-lg px-2 py-1.5 text-sm text-ink-600 hover:bg-white hover:text-ink-800 transition-colors scroll-mt-24"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
