"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
    isActive: (p) => p.startsWith("/hiring/templates"),
  },
  {
    href: "/hiring/activity",
    label: "Activity",
    isActive: (p) => p === "/hiring/activity" || p.startsWith("/hiring/activity/"),
  },
];

function safeInternalFrom(raw: string | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//")) return null;
  if (!v.startsWith("/hiring/")) return null;
  return v;
}

export function HiringSubnav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const applicationsActive =
    pathname === "/hiring/applications" || pathname.startsWith("/hiring/applications/");

  const isApplicationDetail =
    pathname.startsWith("/hiring/applications/") &&
    pathname !== "/hiring/applications" &&
    !pathname.startsWith("/hiring/applications/import");

  const currentApplicationId = useMemo(() => {
    if (!isApplicationDetail) return null;
    const tail = pathname.replace("/hiring/applications/", "");
    return tail && !tail.includes("/") ? tail : null;
  }, [isApplicationDetail, pathname]);

  const from = useMemo(() => safeInternalFrom(searchParams.get("from")), [searchParams]);
  const tab = searchParams.get("tab");

  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);

  useEffect(() => {
    if (!currentApplicationId) return;

    const ac = new AbortController();
    queueMicrotask(() => {
      if (ac.signal.aborted) return;
      setLoadingPrev(true);
      setLoadingNext(true);
      setPrevId(null);
      setNextId(null);
    });

    const qs = new URLSearchParams();
    qs.set("currentId", currentApplicationId);
    if (from) qs.set("from", from);

    const parseAdjacentId = (data: unknown, key: "prevId" | "nextId") => {
      const id = (data as { ok?: boolean } & Record<string, unknown>)?.[key];
      return typeof id === "string" || id === null ? id : null;
    };

    const fetchAdjacent = (path: "prev" | "next") =>
      fetch(`/api/hiring/applications/${path}?${qs.toString()}`, {
        method: "GET",
        signal: ac.signal,
        headers: { "Cache-Control": "no-store" },
      }).then(async (r) => {
        if (!r.ok) return null;
        const data = await r.json();
        return parseAdjacentId(data, path === "prev" ? "prevId" : "nextId");
      });

    Promise.all([fetchAdjacent("prev"), fetchAdjacent("next")])
      .then(([prev, next]) => {
        if (ac.signal.aborted) return;
        setPrevId(prev ?? null);
        setNextId(next ?? null);
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setPrevId(null);
          setNextId(null);
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) {
          setLoadingPrev(false);
          setLoadingNext(false);
        }
      });

    return () => ac.abort();
  }, [currentApplicationId, from]);

  const adjacentHref = useMemo(() => {
    return (id: string | null) => {
      if (!id) return null;
      const qs = new URLSearchParams();
      if (tab) qs.set("tab", tab);
      if (from) qs.set("from", from);
      const tail = qs.toString();
      return tail ? `/hiring/applications/${id}?${tail}` : `/hiring/applications/${id}`;
    };
  }, [tab, from]);

  const prevHref = adjacentHref(prevId);
  const nextHref = adjacentHref(nextId);

  const canGoPrev = Boolean(prevHref) && !loadingPrev;
  const canGoNext = Boolean(nextHref) && !loadingNext;

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
          isApplicationDetail ? (
            <div className="shrink-0 flex items-center gap-2">
              {canGoPrev && prevHref ? (
                <Link href={prevHref}>
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="px-3"
                    aria-label="Previous application"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="px-3"
                  aria-label="Previous application"
                  disabled
                >
                  <ChevronLeft className="size-4" />
                </Button>
              )}
              {canGoNext && nextHref ? (
                <Link href={nextHref}>
                  <Button type="button" variant="accent" size="md" className="px-3" aria-label="Next application">
                    <ChevronRight className="size-4" />
                  </Button>
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="accent"
                  size="md"
                  className="px-3"
                  aria-label="Next application"
                  disabled
                >
                  <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          ) : (
            <Link href="/hiring/candidates/new" className="shrink-0">
              <Button type="button" variant="accent" size="md" className="whitespace-nowrap">
                Add candidate
              </Button>
            </Link>
          )
        ) : null}
      </div>
    </nav>
  );
}
