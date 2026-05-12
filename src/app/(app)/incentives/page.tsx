import { Suspense } from "react";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { CounsellorView } from "./_components/CounsellorView";
import { SalesHeadView } from "./_components/SalesHeadView";

type SearchParams = Promise<{
  tab?: string;
  year?: string;
  month?: string;
  historyYear?: string;
  historyMonth?: string;
  cluster?: string;
  team?: string;
}>;

export default async function IncentivesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <IncentivesPageBody sp={sp} />
    </Suspense>
  );
}

async function IncentivesPageBody({
  sp,
}: {
  sp: {
    tab?: string;
    year?: string;
    month?: string;
    historyYear?: string;
    historyMonth?: string;
    cluster?: string;
    team?: string;
  };
}) {
  const me = await requireAppViewer();
  if (!me) return null;

  const {
    tab = "live",
    year: yearStr,
    month: monthStr,
    historyYear: hyStr,
    historyMonth: hmStr,
    cluster = "",
    team = "",
  } = sp;

  const now = new Date();
  const year = yearStr ? parseInt(yearStr) : now.getFullYear();
  const month = monthStr ? parseInt(monthStr) : now.getMonth() + 1;
  const historyYear = hyStr ? parseInt(hyStr) : undefined;
  const historyMonth = hmStr ? parseInt(hmStr) : undefined;

  const isAccountsManager = ["ADMIN", "HR", "CEO"].includes(me.role);
  const isSalesHead = ["MANAGER", "DEPT_HEAD"].includes(me.role);

  return (
    <div>
      <PageHeader
        title="Incentives"
        emoji="💰"
        subtitle={
          isAccountsManager
            ? "Run monthly sheets like sales heads, approve locked payouts, and track disbursements."
            : isSalesHead
              ? "Track your team's revenue, adjust, and lock monthly incentive sheets."
              : "View your estimated incentive for the month."
        }
      />

      {isAccountsManager || isSalesHead ? (
        <Suspense fallback={<Skeleton />}>
          <SalesHeadView
            year={year}
            month={month}
            tab={tab}
            historyYear={historyYear}
            historyMonth={historyMonth}
            userName={me.name ?? (isSalesHead ? "Sales Head" : "Team")}
            cluster={cluster}
            team={team}
            showApprovalsTab={isAccountsManager}
          />
        </Suspense>
      ) : (
        <Suspense fallback={<Skeleton />}>
          <CounsellorView userId={me.id} />
        </Suspense>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-12 rounded-lg bg-ink-100 animate-pulse w-72" />
      <div className="h-32 rounded-xl bg-ink-100 animate-pulse" />
      <div className="h-64 rounded-xl bg-ink-100 animate-pulse" />
    </div>
  );
}
