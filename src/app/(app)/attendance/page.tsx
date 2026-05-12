import { Suspense } from "react";
import { AttendancePageChrome } from "./_components/AttendancePageChrome";
import { AttendancePersonalPanels } from "./_components/AttendancePersonalPanels";
import { AttendanceApproverApprovals } from "./_components/AttendanceApproverApprovals";
import { AttendanceApproverTeam } from "./_components/AttendanceApproverTeam";
import {
  AttendanceApprovalsSkeleton,
  AttendancePersonalSkeleton,
  AttendanceTeamSkeleton,
} from "./_components/AttendanceSkeletons";
import type { AttendancePageQs } from "./_components/attendance-route-state";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<AttendancePageQs>;
}) {
  const qs = await searchParams;

  return (
    <div className="space-y-6">
      <AttendancePageChrome qs={qs} />
      <Suspense fallback={<AttendancePersonalSkeleton />}>
        <AttendancePersonalPanels qs={qs} />
      </Suspense>
      <Suspense fallback={<AttendanceApprovalsSkeleton />}>
        <AttendanceApproverApprovals qs={qs} />
      </Suspense>
      <Suspense fallback={<AttendanceTeamSkeleton />}>
        <AttendanceApproverTeam qs={qs} />
      </Suspense>
    </div>
  );
}
