import Image from "next/image";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, weekStartDate } from "@/lib/utils";
import { firstSearchParam } from "@/lib/search-param";
import { getPulseWeekConfig } from "@/lib/pulse";
import { PulseSubmissionForm } from "./_components/pulse-submission-form";
import { PulseTrendChart } from "./_components/pulse-trend-chart";

const FACES = [
  { v: 1, e: "😩", l: "Tough" },
  { v: 2, e: "😕", l: "Meh" },
  { v: 3, e: "😐", l: "Okay" },
  { v: 4, e: "🙂", l: "Good" },
  { v: 5, e: "🤩", l: "Great" },
];

export default function PulsePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  return (
    <div>
      <PageHeader
        title="Weekly Pulse"
        emoji="💗"
        subtitle="One question a week. A minute to answer. You — and SIB — get better."
      />
      <Suspense fallback={<RouteBodyFallback />}>
        <PulsePageBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function PulsePageBody({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const me = await requireAppViewer();
  if (!me) return null;

  const sp = await searchParams;
  const flashSaved = firstSearchParam(sp.saved) === "1";

  const weekStart = weekStartDate();
  const weekConfig = await getPulseWeekConfig(weekStart);

  const [thisWeek, history] = await Promise.all([
    prisma.pulseResponse.findUnique({
      where: { userId_weekStart: { userId: me.id, weekStart } },
    }),
    prisma.pulseResponse.findMany({
      where: { userId: me.id },
      orderBy: { weekStart: "desc" },
      take: 10,
    }),
  ]);

  const avg = history.length
    ? (history.reduce((a, r) => a + r.score, 0) / history.length).toFixed(1)
    : "—";

  const trendPoints = history.map((p) => ({ weekStart: p.weekStart, score: p.score }));

  return (
    <>
      {flashSaved && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Pulse saved for this week. You can update it anytime before the week ends.
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-5 p-4 rounded-xl bg-gradient-to-r from-sky-50 to-orange-50 border border-sky-100">
            <div className="relative shrink-0">
              <div className="size-14 rounded-full overflow-hidden ring-2 ring-white shadow-md">
                <Image
                  src="/ritvik.jpeg"
                  alt=""
                  width={56}
                  height={56}
                  className="object-cover object-top size-full"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 text-base">💗</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-sky-600">{weekConfig.promptLabel}</div>
              <p className="text-base font-semibold text-ink-700 mt-0.5 leading-snug">{weekConfig.question}</p>
              <div className="text-xs text-ink-400 mt-1">Week of {formatDate(weekStart)}</div>
            </div>
          </div>

          <PulseSubmissionForm
            initialScore={thisWeek?.score}
            initialComment={thisWeek?.comment ?? undefined}
            hasExisting={!!thisWeek}
          />
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-ink-700">Your trend</CardTitle>
          </CardHeader>
          <CardContent>
            <PulseTrendChart points={trendPoints} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-ink-700">Your last {history.length || 0} weeks</h3>
            <Badge tone="sky">avg {avg}/5</Badge>
          </div>
          {history.length === 0 ? (
            <div className="text-sm text-ink-400 text-center py-6">No pulse history yet.</div>
          ) : (
            <ul className="space-y-2">
              {history.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-b-0">
                  <div className="text-2xl">{FACES.find((f) => f.v === p.score)?.e}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-ink-400">Week of {formatDate(p.weekStart)}</div>
                    {p.question && p.question !== weekConfig.question && (
                      <p className="text-xs text-ink-500 mt-0.5 line-clamp-2">{p.question}</p>
                    )}
                    {p.comment && (
                      <p className="text-sm text-ink-600 mt-0.5 truncate italic">&quot;{p.comment}&quot;</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
