import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { CounsellorView } from "./_components/CounsellorView";
import { SalesHeadView } from "./_components/SalesHeadView";
import { AccountsView } from "./_components/AccountsView";

export default async function IncentivesPage() {
  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    include: { department: true },
  });
  if (!me) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const isAccountsManager = ["ADMIN", "HR", "CEO"].includes(me.role);
  const isSalesHead = ["MANAGER", "DEPT_HEAD"].includes(me.role);

  return (
    <div>
      <PageHeader
        title="Incentives"
        emoji="💰"
        subtitle={
          isAccountsManager
            ? "Review locked sheets, approve payouts, and track disbursements."
            : isSalesHead
            ? "Track your team's sales, apply adjustments, and lock monthly sheets."
            : "Log your sales and see your live estimated incentive for the month."
        }
      />

      {isAccountsManager ? (
        <Suspense fallback={<LoadingSkeleton />}>
          <AccountsView />
        </Suspense>
      ) : isSalesHead ? (
        <Suspense fallback={<LoadingSkeleton />}>
          <SalesHeadView year={year} month={month} />
        </Suspense>
      ) : (
        <Suspense fallback={<LoadingSkeleton />}>
          <CounsellorView userId={me.id} />
        </Suspense>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-40 rounded-2xl bg-ink-100 animate-pulse" />
      <div className="h-64 rounded-xl bg-ink-100 animate-pulse" />
    </div>
  );
}
