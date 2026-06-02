import { Suspense } from "react";
import Link from "next/link";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { CelebrationsToday } from "./_components/CelebrationsToday";
import { CelebrationCard } from "./_components/CelebrationCard";
import { loadCelebrationsData } from "./_lib/celebrations-data";

export default function CelebrationsPage() {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <CelebrationsPageBody />
    </Suspense>
  );
}

async function CelebrationsPageBody() {
  const me = await requireAppViewer();
  if (!me) return null;

  const data = await loadCelebrationsData();
  const upcomingBirthdays = data.birthdays.filter((e) => !e.isToday);
  const upcomingAnniversaries = data.workAversaries.filter((e) => !e.isToday);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Celebrations"
        emoji="🎉"
        subtitle="Birthdays and work-aversaries — never miss a moment."
        action={
          <Link
            href="/wins?tab=wall&action=celebrate"
            className="text-sm font-medium text-sky-600 hover:underline"
          >
            Celebrate a win →
          </Link>
        }
      />

      <CelebrationsToday entries={data.today} />

      <div className="grid md:grid-cols-2 gap-8">
        <section>
          <h2 className="text-sm font-semibold text-ink-600 mb-3">
            🎂 Birthdays — next {data.horizonDays} days
          </h2>
          {data.birthdays.length === 0 ? (
            <Card className="p-6 text-center text-sm text-ink-400">
              No birthdays in the next {data.horizonDays} days.
            </Card>
          ) : upcomingBirthdays.length === 0 && data.today.some((e) => e.kind === "birthday") ? (
            <p className="text-sm text-ink-400 px-1">Everyone with a birthday this month is celebrating today.</p>
          ) : (
            <div className="space-y-3">
              {upcomingBirthdays.map((entry) => (
                <CelebrationCard key={entry.userId} entry={entry} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-ink-600 mb-3">
            💼 Work-aversaries — next {data.horizonDays} days
          </h2>
          {data.workAversaries.length === 0 ? (
            <EmptyState
              emoji="💼"
              title="No work-aversaries soon"
              description={`No one hits a work anniversary in the next ${data.horizonDays} days.`}
            />
          ) : upcomingAnniversaries.length === 0 &&
            data.today.some((e) => e.kind === "work-aversary") ? (
            <p className="text-sm text-ink-400 px-1">All upcoming work-aversaries are today.</p>
          ) : (
            <div className="space-y-3">
              {upcomingAnniversaries.map((entry) => (
                <CelebrationCard key={entry.userId} entry={entry} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
