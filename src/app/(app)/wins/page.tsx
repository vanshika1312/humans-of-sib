import { Suspense } from "react";
import { requireAppViewer } from "@/lib/app-viewer";
import { canAwardWins, parseWinWallTab } from "@/lib/win-wall-access";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { EmptyState } from "@/components/ui/page-header";
import { WinWallChrome } from "./_components/WinWallChrome";
import { WinWallStats } from "./_components/WinWallStats";
import { WinWallSpotlight } from "./_components/WinWallSpotlight";
import { WinWallRecentWins } from "./_components/WinWallRecentWins";
import { WinWallLeaderboard } from "./_components/WinWallLeaderboard";
import { WinWallCertificates } from "./_components/WinWallCertificates";
import { WinNominateForm } from "./_components/WinNominateForm";
import { WinWallHistory } from "./_components/WinWallHistory";
import { WinCelebrateForm } from "./_components/WinCelebrateForm";
import { loadWinWallData } from "./_lib/win-wall-data";

type SearchParams = Promise<{ tab?: string; action?: string }>;

export default function WinsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <WinsPageInner searchParams={searchParams} />
    </Suspense>
  );
}

async function WinsPageInner({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireAppViewer();
  if (!me) return null;

  const sp = await searchParams;
  const tab = parseWinWallTab(sp.tab);
  const canAward = canAwardWins(me.role);

  return (
    <div className="space-y-6 max-w-5xl">
      <WinWallChrome tab={sp.tab} canAward={canAward} adminAction={sp.action} />
      <Suspense fallback={<RouteBodyFallback />}>
        <WinsPageBody tab={tab} action={sp.action} viewerId={me.id} canAward={canAward} />
      </Suspense>
    </div>
  );
}

async function WinsPageBody({
  tab,
  action,
  viewerId,
  canAward,
}: {
  tab: ReturnType<typeof parseWinWallTab>;
  action?: string;
  viewerId: string;
  canAward: boolean;
}) {
  const data = await loadWinWallData(viewerId);
  const year = new Date().getFullYear();

  if (tab === "wall") {
    return (
      <div className="space-y-6">
        {canAward && action === "celebrate" && <WinCelebrateForm members={data.members} />}
        <WinWallStats stats={data.stats} />
        {data.spotlightWin ? (
          <WinWallSpotlight win={data.spotlightWin} viewerId={data.viewerId} monthLabel={data.monthLabel} />
        ) : null}
        {data.recentWins.length === 0 ? (
          <EmptyState
            emoji="🏆"
            title="No wins yet"
            description={
              canAward
                ? "Celebrate the first win for your team using the button above."
                : "Nominate a teammate from the Nominate tab."
            }
          />
        ) : (
          <WinWallRecentWins wins={data.recentWins} viewerId={data.viewerId} />
        )}
      </div>
    );
  }

  if (tab === "leaderboard") {
    return <WinWallLeaderboard rows={data.leaderboard} monthLabel={data.monthLabel} />;
  }

  if (tab === "certificates") {
    return (
      <WinWallCertificates
        latest={data.latestCert}
        members={data.members}
        canIssue={canAward}
        template={data.certTemplate}
        customizeOpen={action === "customize"}
      />
    );
  }

  if (tab === "nominate") {
    return <WinNominateForm members={data.members} />;
  }

  return <WinWallHistory wins={data.historyWins} year={year} />;
}
