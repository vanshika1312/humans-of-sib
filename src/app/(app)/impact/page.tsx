import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const METRIC_LABEL: Record<string, { label: string; emoji: string; color: string }> = {
  learners_enrolled: { label: "Learners enrolled", emoji: "🌱", color: "text-sky-600" },
  classes_taken: { label: "Classes taken", emoji: "🎓", color: "text-orange-600" },
  portfolios_shipped: { label: "Portfolios shipped", emoji: "📦", color: "text-sun-600" },
  income_launched: { label: "Income launched (₹)", emoji: "💰", color: "text-emerald-600" },
};

export default function ImpactPage() {
  return (
    <div>
      <PageHeader
        title="Learner Impact"
        emoji="💎"
        subtitle="At Skillinabox, your work changes lives. Here's yours, by the numbers."
      />
      <Suspense fallback={<RouteBodyFallback />}>
        <ImpactPageBody />
      </Suspense>
    </div>
  );
}

async function ImpactPageBody() {
  const me = await requireAppViewer();
  if (!me) return null;

  const records = await prisma.learnerImpact.findMany({
    where: { userId: me.id },
    orderBy: [{ period: "desc" }, { metric: "asc" }],
  });

  // Sum per metric
  const totals: Record<string, number> = {};
  for (const r of records) totals[r.metric] = (totals[r.metric] || 0) + r.value;

  // Group by period
  const byPeriod: Record<string, typeof records> = {};
  for (const r of records) (byPeriod[r.period] ||= []).push(r);

  return (
    <>
      <Card className="mb-6 overflow-hidden">
        <div className="brand-gradient p-6 text-white">
          <div className="text-sm opacity-90">All-time</div>
          <h2 className="text-2xl font-bold mt-1">The lives you&apos;ve touched ✨</h2>
        </div>
        <CardContent className="pt-5">
          {Object.keys(totals).length === 0 ? (
            <EmptyState emoji="💎" title="Impact will appear here" description="As you teach, counsel, or support, your impact numbers show up here." />
          ) : (
            <div className="grid md:grid-cols-4 gap-3">
              {Object.entries(totals).map(([metric, value]) => {
                const meta = METRIC_LABEL[metric] || { label: metric, emoji: "📊", color: "text-ink-700" };
                return (
                  <div key={metric} className="p-4 rounded-lg bg-ink-50">
                    <div className="text-2xl">{meta.emoji}</div>
                    <div className={`text-2xl font-bold mt-1 ${meta.color}`}>
                      {metric === "income_launched" ? `₹${Number(value).toLocaleString("en-IN")}` : value.toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs text-ink-400 mt-0.5">{meta.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {Object.keys(byPeriod).length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-ink-600 mb-3">By period</h2>
          <div className="space-y-4">
            {Object.entries(byPeriod).map(([period, items]) => (
              <Card key={period}>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge tone="sky">{period}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {items.map((r) => {
                      const meta = METRIC_LABEL[r.metric] || { label: r.metric, emoji: "📊", color: "text-ink-700" };
                      return (
                        <div key={r.id} className="p-3 rounded-lg bg-ink-50">
                          <div className="text-lg">{meta.emoji}</div>
                          <div className={`text-lg font-bold ${meta.color}`}>
                            {r.metric === "income_launched" ? `₹${Number(r.value).toLocaleString("en-IN")}` : r.value.toLocaleString("en-IN")}
                          </div>
                          <div className="text-xs text-ink-400">{meta.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
