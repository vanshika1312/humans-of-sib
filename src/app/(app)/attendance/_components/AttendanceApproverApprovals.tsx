import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { pendingApprovalUserWhere, type AttendanceApproverContext } from "@/lib/attendance-scope";
import {
  paidLeaveApproverBalancePreviewCached,
  prefetchPaidLeaveBalancePreviewContext,
} from "@/lib/leave-balance-guard";
import { workingDaysByHalfYearForLeave } from "@/lib/leave-policy";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { formatDate, formatTime } from "@/lib/utils";
import { formatCalendarDate } from "@/lib/calendar-date";
import { sickLeaveMedicalProofRequired } from "@/lib/sick-leave-medical-proof";
import { reviewRegularisationForm, reviewLeaveForm } from "../actions";
import type { AttendancePageQs } from "./attendance-route-state";
import { deriveAttendanceRouteState } from "./attendance-route-state";
import { leaveApprovalsBalanceLabel, modeStyle, type AttendanceMode } from "./attendance-shared";

export async function AttendanceApproverApprovals({ qs }: { qs: AttendancePageQs }) {
  const me = await requireAppViewer();
  if (!me) return null;

  const { activeTab } = deriveAttendanceRouteState(qs);
  const isApprover = ["MANAGER", "DEPT_HEAD", "HR", "CEO", "ADMIN"].includes(me.role);
  if (!isApprover || activeTab !== "requests") return null;

  const viewerCtx: AttendanceApproverContext = {
    id: me.id,
    role: me.role,
    headedDeptId: me.headedDept?.id ?? null,
  };
  const pendingUserWhere = pendingApprovalUserWhere(viewerCtx);

  const [pendingRegularisations, pendingLeaves] = await Promise.all([
    prisma.regularisationRequest.findMany({
      where: pendingUserWhere ? { status: "PENDING", user: pendingUserWhere } : { status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, image: true, managerId: true, departmentId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: pendingUserWhere ? { status: "PENDING", user: pendingUserWhere } : { status: "PENDING" },
      include: {
        user: { select: { id: true, name: true, image: true, managerId: true, departmentId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const leaveBalancePrefetch = await prefetchPaidLeaveBalancePreviewContext(
    pendingLeaves.map((r) => ({
      userId: r.userId,
      type: r.type,
      startDate: r.startDate,
      endDate: r.endDate,
      isHalfDay: r.isHalfDay,
    })),
  );

  const pendingLeaveRows = await Promise.all(
    pendingLeaves.map(async (r) => {
      const ledgerDebitDaysDefault =
        r.type === "UNPAID"
          ? null
          : [...workingDaysByHalfYearForLeave(r.startDate, r.endDate, r.isHalfDay).values()].reduce((a, b) => a + b, 0);

      const balancePreview = paidLeaveApproverBalancePreviewCached(
        {
          userId: r.userId,
          type: r.type,
          startDate: r.startDate,
          endDate: r.endDate,
          isHalfDay: r.isHalfDay,
        },
        leaveBalancePrefetch,
      );
      const insufficientPaidBalanceForDefault =
        balancePreview.ledgerKind !== null && !balancePreview.sufficientForFullDefaultDebit;

      if (r.type !== "SICK") {
        return {
          ...r,
          incompleteMedical: false,
          ledgerDebitDaysDefault,
          insufficientPaidBalanceForDefault,
        };
      }
      const need = await sickLeaveMedicalProofRequired(r.userId, r.startDate, r.endDate);
      const incompleteMedical = need && !r.medicalProofUrl?.trim();
      return { ...r, incompleteMedical, ledgerDebitDaysDefault, insufficientPaidBalanceForDefault };
    }),
  );

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-ink-600">Approvals</h2>

      {pendingRegularisations.length === 0 && pendingLeaves.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-ink-400 text-center">
              No pending regularisation or leave requests in your scope.
            </p>
          </CardContent>
        </Card>
      )}

      {pendingRegularisations.length > 0 && (
        <Card>
          <div className="px-5 py-3 border-b border-ink-100">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Regularisation ({pendingRegularisations.length})
            </span>
          </div>
          <CardContent className="pt-4 space-y-4">
            {pendingRegularisations.map((r) => (
              <div key={r.id} className="rounded-lg border border-ink-100 p-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Avatar src={r.user.image} name={r.user.name} size="sm" />
                  <span className="font-medium text-ink-700">{r.user.name}</span>
                  <span className="text-sm text-ink-500">{formatDate(r.date)}</span>
                  <Badge tone="sun">{r.requestMode ? modeStyle(r.requestMode as AttendanceMode).label : "—"}</Badge>
                </div>
                <p className="text-sm text-ink-600">{r.reason}</p>
                <p className="text-xs text-ink-400">
                  {r.markFullDayPresent ? (
                    <>Proposed: full day present (10:00–19:30 IST after approval)</>
                  ) : (
                    <>
                      Proposed: {r.requestCheckIn ? formatTime(r.requestCheckIn) : "—"}
                      {" → "}
                      {r.requestCheckOut ? formatTime(r.requestCheckOut) : "—"}
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 items-end">
                  <form action={reviewRegularisationForm} className="flex gap-2 items-end flex-wrap">
                    <input type="hidden" name="requestId" value={r.id} />
                    <input type="hidden" name="reviewAction" value="approve" />
                    <Button type="submit" size="sm" variant="accent">
                      Approve
                    </Button>
                  </form>
                  <form action={reviewRegularisationForm} className="flex gap-2 items-end flex-wrap">
                    <input type="hidden" name="requestId" value={r.id} />
                    <input type="hidden" name="reviewAction" value="reject" />
                    <Input name="reviewNote" placeholder="Note (optional)" className="h-9 w-44" />
                    <Button type="submit" size="sm" variant="outline">
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pendingLeaveRows.length > 0 && (
        <Card>
          <div className="px-5 py-3 border-b border-ink-100">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Leave ({pendingLeaveRows.length})
            </span>
          </div>
          <CardContent className="pt-4 space-y-4">
            {pendingLeaveRows.map((r) => (
              <div key={r.id} className="rounded-lg border border-ink-100 p-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Avatar src={r.user.image} name={r.user.name} size="sm" />
                  <span className="font-medium text-ink-700">{r.user.name}</span>
                  <Badge tone="sky">{r.type}</Badge>
                  {r.isHalfDay && <Badge tone="sun">Half day</Badge>}
                  {r.incompleteMedical && <Badge tone="orange">Medical proof missing</Badge>}
                </div>
                <p className="text-sm text-ink-600">
                  {formatCalendarDate(r.startDate)} → {formatCalendarDate(r.endDate)}
                </p>
                {r.reason && <p className="text-sm text-ink-500 italic">&quot;{r.reason}&quot;</p>}
                {r.medicalProofUrl?.trim() && (
                  <p className="text-xs text-ink-500">
                    Medical proof:{" "}
                    <a
                      href={r.medicalProofUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 underline underline-offset-2"
                    >
                      Open link
                    </a>
                  </p>
                )}
                {r.incompleteMedical && (
                  <p className="text-xs text-ink-500">
                    Approve is blocked until they attach a certificate link under the Leave &amp; regularisation tab → My
                    recent requests.
                  </p>
                )}
                {r.insufficientPaidBalanceForDefault ? (
                  <div className="rounded-md border border-orange-300 bg-orange-50/90 px-3 py-2 text-[11px] text-orange-950">
                    <span className="font-semibold">Balance warning:</span> the default weekday charge is more than this
                    person&apos;s remaining {leaveApprovalsBalanceLabel(r.type)} days. Approve anyway by lowering &quot;Days
                    to charge&quot; below (or reject the request).
                  </div>
                ) : null}
                {r.ledgerDebitDaysDefault !== null && (
                  <div className="rounded-md bg-ink-50 px-3 py-2 space-y-1">
                    <p className="text-[11px] text-ink-600">
                      Default ledger charge ·{" "}
                      <span className="font-medium text-ink-800">
                        {r.ledgerDebitDaysDefault} {leaveApprovalsBalanceLabel(r.type)} weekday
                        {Number(r.ledgerDebitDaysDefault) === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="text-[10px] text-ink-400">
                      Approve uses this total unless you enter a smaller number below (allocated across policy halves
                      proportionally).
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 items-end">
                  <form action={reviewLeaveForm} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    {r.ledgerDebitDaysDefault !== null ? (
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`leaveDebit-${r.id}`} className="text-xs">
                          Days to charge (optional)
                        </Label>
                        <Input
                          id={`leaveDebit-${r.id}`}
                          name="leaveBalanceDebitOverride"
                          type="number"
                          min={0}
                          max={r.ledgerDebitDaysDefault}
                          step={0.5}
                          placeholder={String(r.ledgerDebitDaysDefault)}
                          disabled={r.incompleteMedical}
                          className="h-9 w-28"
                        />
                      </div>
                    ) : null}
                    <input type="hidden" name="leaveId" value={r.id} />
                    <input type="hidden" name="leaveReviewAction" value="approve" />
                    <Button type="submit" size="sm" variant="accent" disabled={r.incompleteMedical}>
                      Approve
                    </Button>
                  </form>
                  <form action={reviewLeaveForm} className="flex gap-2 items-end flex-wrap">
                    <input type="hidden" name="leaveId" value={r.id} />
                    <input type="hidden" name="leaveReviewAction" value="reject" />
                    <Input name="leaveReviewNote" placeholder="Note (optional)" className="h-9 w-44" />
                    <Button type="submit" size="sm" variant="outline">
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
