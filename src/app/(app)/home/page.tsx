import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { HeroGreeting } from "./_components/HeroGreeting";
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

  const eventsCount = await prisma.journeyEvent.count({ where: { userId: me.id } });

  return (
    <div className="space-y-6">
      <HeroGreeting name={me.name} image={me.image} eventsCount={eventsCount} />

      <Suspense fallback={<div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-ink-100 animate-pulse" />)}</div>}>
        <QuickStats userId={me.id} />
      </Suspense>

      <Suspense fallback={<div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-ink-100 animate-pulse" />)}</div>}>
        <OrgMetrics />
      </Suspense>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-5">
          <Suspense fallback={<div className="h-64 rounded-xl bg-ink-100 animate-pulse" />}>
            <AnnouncementFeed viewer={{ id: me.id, name: me.name, image: me.image, role: me.role }} />
          </Suspense>
          <Suspense fallback={<div className="h-64 rounded-xl bg-ink-100 animate-pulse" />}>
            <WinsWall />
          </Suspense>
          <DirectToCEO />
        </div>

        <div className="space-y-5">
          <HolidayCalendar />
          <Suspense fallback={<div className="h-48 rounded-xl bg-ink-100 animate-pulse" />}>
            <UpcomingCelebrations />
          </Suspense>

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
