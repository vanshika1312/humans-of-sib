import { Suspense } from "react";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { QuickStats } from "./_components/QuickStats";
import { OrgMetrics } from "./_components/OrgMetrics";
import { WinsWall } from "./_components/WinsWall";
import { DirectToCEO } from "./_components/DirectToCEO";
import { UpcomingCelebrations } from "./_components/UpcomingCelebrations";
import { CeoInbox } from "./_components/CeoInbox";
import { QuickActions } from "./_components/QuickActions";
import { AnnouncementFeed } from "./_components/AnnouncementFeed";
import { HolidayCalendar } from "./_components/HolidayCalendar";

export default function HomePage() {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <HomePageBody />
    </Suspense>
  );
}

async function HomePageBody() {
  const me = await requireAppViewer();
  if (!me) return null;

  return (
    <div data-app-fullwidth className="min-h-0 lg:min-h-[calc(100vh-56px)]">
      <div className="grid gap-5 lg:grid-cols-3 min-h-0 lg:min-h-[calc(100vh-56px)] items-stretch">
        <div className="lg:col-span-2 flex flex-col gap-5 min-w-0 min-h-0">
          <Suspense fallback={<div className="h-[70vh] rounded-xl bg-ink-100 animate-pulse" />}>
            <AnnouncementFeed viewer={{ id: me.id, name: me.name, image: me.image, role: me.role }} />
          </Suspense>
        </div>

        <div className="space-y-5 bg-[var(--color-background)] lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:min-h-0 lg:pr-1">
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-ink-100 animate-pulse" />
                ))}
              </div>
            }
          >
            <QuickStats userId={me.id} />
          </Suspense>

          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-ink-100 animate-pulse" />
                ))}
              </div>
            }
          >
            <OrgMetrics />
          </Suspense>

          <HolidayCalendar />

          <Suspense fallback={<div className="h-48 rounded-xl bg-ink-100 animate-pulse" />}>
            <UpcomingCelebrations />
          </Suspense>

          <Suspense fallback={<div className="h-64 rounded-xl bg-ink-100 animate-pulse" />}>
            <WinsWall />
          </Suspense>

          <DirectToCEO />

          {me.role === "CEO" && (
            <Suspense fallback={<div className="h-32 rounded-xl bg-ink-100 animate-pulse" />}>
              <CeoInbox />
            </Suspense>
          )}

          <QuickActions />
        </div>
      </div>
    </div>
  );
}
