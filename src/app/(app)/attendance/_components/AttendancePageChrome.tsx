import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { AttendanceTabNav } from "./AttendanceTabNav";
import type { AttendancePageQs } from "./attendance-route-state";
import { deriveAttendanceRouteState } from "./attendance-route-state";

export function AttendancePageChrome({ qs }: { qs: AttendancePageQs }) {
  const { activeTab, viewYear, viewMonth } = deriveAttendanceRouteState(qs);

  return (
    <>
      <PageHeader
        title="Attendance"
        emoji="🟢"
        subtitle="Tabs separate your punch log from leave and regularisation — fewer scroll, same tools."
      />

      {qs.leaveApplyError === "half_day" && (
        <Card className="border-orange-300 bg-orange-50/90">
          <CardContent className="pt-4 pb-4 text-sm text-orange-950">
            <p>
              <span className="font-semibold">Request not submitted.</span> Half day must cover{" "}
              <strong className="font-medium">exactly one working day</strong> — set From and To to the same date on a
              weekday (Mon–Sat, Sun off).
            </p>
          </CardContent>
        </Card>
      )}

      {(qs.leaveApplyError === "insufficient_balance" || qs.leaveApplyError === "medical_proof") && (
        <Card className="border-orange-300 bg-orange-50/90">
          <CardContent className="pt-4 pb-4 text-sm text-orange-950">
            {qs.leaveApplyError === "insufficient_balance" ? (
              <p>
                <span className="font-semibold">Request not submitted.</span> Policy mode requires enough remaining paid
                leave for the weekdays in your selected range (or choose Unpaid). Shorten the range or ask HR about your
                balance.
              </p>
            ) : (
              <p>
                <span className="font-semibold">Request not submitted.</span> Sick policy requires a medical document
                link when this booking needs proof.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {(qs.leaveApprovalError === "insufficient_balance" || qs.leaveApprovalError === "medical_proof") && (
        <Card className="border-orange-300 bg-orange-50/90">
          <CardContent className="pt-4 pb-4 text-sm text-orange-950">
            {qs.leaveApprovalError === "insufficient_balance" ? (
              <p>
                <span className="font-semibold">Approval did not complete.</span> The ledger charge is larger than what
                this person has left. Try a smaller &quot;Days to charge&quot; or reject — or employee resubmits with a
                different type.
              </p>
            ) : (
              <p>
                <span className="font-semibold">Approval did not complete.</span> Sick policy still requires proof for
                this request.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <AttendanceTabNav active={activeTab} viewYear={viewYear} viewMonth={viewMonth} />
    </>
  );
}
