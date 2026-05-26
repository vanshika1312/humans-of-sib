import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HiringActivityFeed } from "@/components/hiring/hiring-activity-feed";
import {
  HIRING_ACTIVITY_KIND_FILTER_ORDER,
  HIRING_ACTIVITY_KIND_LABEL,
} from "@/lib/hiring-activity-kind-copy";
import type { HiringActivityKind } from "@/generated/prisma";
import { firstSearchParam } from "@/lib/search-param";

const PAGE_SIZE = 40;

function isActivityKind(raw: string | undefined): raw is HiringActivityKind {
  return Boolean(raw && raw in HIRING_ACTIVITY_KIND_LABEL);
}

export default async function HiringActivityHistoryPage(props: {
  searchParams: Promise<{ kind?: string | string[]; page?: string | string[] }>;
}) {
  const sp = await props.searchParams;
  const kindRaw = firstSearchParam(sp.kind);
  const kindFilter = isActivityKind(kindRaw) ? kindRaw : undefined;
  const pageRaw = Number(firstSearchParam(sp.page) ?? "1");
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const where = kindFilter ? { kind: kindFilter } : {};

  const [events, total] = await Promise.all([
    prisma.hiringActivity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      include: {
        actor: { select: { name: true, email: true } },
        candidate: { select: { id: true, fullName: true, email: true } },
        application: {
          select: {
            id: true,
            job: { select: { id: true, title: true } },
          },
        },
      },
    }),
    prisma.hiringActivity.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  function pageHref(nextPage: number, kind?: HiringActivityKind) {
    const qs = new URLSearchParams();
    if (kind) qs.set("kind", kind);
    if (nextPage > 1) qs.set("page", String(nextPage));
    const tail = qs.toString();
    return tail ? `/hiring/activity?${tail}` : "/hiring/activity";
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        emoji="🕘"
        title="Activity history"
        subtitle="A running log of changes across candidates, applications, job postings, pipeline stages, templates, and requisitions."
      />

      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/60">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle>Recent events</CardTitle>
            <p className="text-xs text-ink-500 tabular-nums">
              {total} event{total === 1 ? "" : "s"}
              {kindFilter ? ` · ${HIRING_ACTIVITY_KIND_LABEL[kindFilter]}` : ""}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-6">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 max-w-md">
              <label htmlFor="activity-kind" className="text-xs font-medium text-ink-500 block mb-1">
                Event type
              </label>
              <select
                id="activity-kind"
                name="kind"
                defaultValue={kindFilter ?? ""}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              >
                <option value="">All events</option>
                {HIRING_ACTIVITY_KIND_FILTER_ORDER.map((k) => (
                  <option key={k} value={k}>
                    {HIRING_ACTIVITY_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" variant="accent">
              Apply filter
            </Button>
            {kindFilter ? (
              <Link href="/hiring/activity">
                <Button type="button" size="sm" variant="outline">
                  Clear
                </Button>
              </Link>
            ) : null}
          </form>

          <HiringActivityFeed
            events={events}
            emptyMessage={
              kindFilter
                ? `No events of type “${HIRING_ACTIVITY_KIND_LABEL[kindFilter]}” yet.`
                : "No hiring activity recorded yet — changes will appear here as your team works in this section."
            }
            timelineSurface
          />

          {total > PAGE_SIZE ? (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-ink-100">
              <p className="text-xs text-ink-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {hasPrev ? (
                  <Link href={pageHref(page - 1, kindFilter)}>
                    <Button type="button" variant="outline" size="sm">
                      ← Newer
                    </Button>
                  </Link>
                ) : (
                  <Button type="button" variant="outline" size="sm" disabled>
                    ← Newer
                  </Button>
                )}
                {hasNext ? (
                  <Link href={pageHref(page + 1, kindFilter)}>
                    <Button type="button" variant="outline" size="sm">
                      Older →
                    </Button>
                  </Link>
                ) : (
                  <Button type="button" variant="outline" size="sm" disabled>
                    Older →
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
