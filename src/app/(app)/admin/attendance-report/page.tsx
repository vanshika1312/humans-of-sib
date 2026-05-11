import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  PAYROLL_REPORT_ROLES,
  fetchPayrollAttendanceReport,
  REPORT_HALF_DAY_IF_HOURS_BELOW,
  REPORT_LATE_AFTER_IST,
  REPORT_LATES_PER_HALF_DAY,
  REPORT_MIN_HOURS_FOR_HALF_DAY,
} from "@/lib/payroll-attendance-report";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { AttendanceCsvImport } from "./_components/AttendanceCsvImport";
import { AttendanceCsvDelete } from "./_components/AttendanceCsvDelete";
import { ReportMonthNav } from "@/components/report-month-nav";
import { Suspense } from "react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function clampYear(y: number): number {
  if (!Number.isFinite(y)) return new Date().getFullYear();
  return Math.min(2035, Math.max(2020, y));
}

function clampMonth(m: number): number {
  if (!Number.isFinite(m)) return new Date().getMonth() + 1;
  return Math.min(12, Math.max(1, m));
}

export default async function AdminAttendanceReportPage(props: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    select: { role: true },
  });
  if (!me || !(PAYROLL_REPORT_ROLES as readonly string[]).includes(me.role)) {
    redirect("/home");
  }

  const sp = await props.searchParams;
  const now = new Date();
  const year = clampYear(parseInt(sp.year ?? String(now.getFullYear()), 10));
  const month = clampMonth(parseInt(sp.month ?? String(now.getMonth() + 1), 10));

  const { summaries, details } = await fetchPayrollAttendanceReport(year, month);
  const nowUtc = new Date();
  const curYear = nowUtc.getUTCFullYear();
  const curMonth = nowUtc.getUTCMonth() + 1;
  const isViewingCurrentMonth = year === curYear && month === curMonth;

  const totalPresent = summaries.reduce((a, r) => a + r.presentDays, 0);
  const exportBase = `/admin/attendance-report/export?year=${year}&month=${month}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance · Payroll export"
        emoji="📊"
        subtitle="Month-level punches, approved leave by type, and pending vs rejected leave weekdays — CSV for spreadsheets."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" asChild>
              <a href={`${exportBase}&format=summary`}>
                <Download className="size-4" />
                Summary CSV
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${exportBase}&format=detail`}>
                <Download className="size-4" />
                Detail CSV
              </a>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import test attendance (CSV)</CardTitle>
          <CardDescription>
            Upsert punches from a file—then pick the month above (or step with arrows) and confirm Late, Half day, and
            Deduction match your expectations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceCsvImport templateHref="/admin/attendance-report/import-template" />
          <AttendanceCsvDelete deleteTemplateHref="/admin/attendance-report/delete-template" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{MONTHS[month - 1]} {year}</CardTitle>
            <CardDescription>
              Rows: {summaries.length} employee{summaries.length !== 1 ? "s" : ""} (everyone active, plus anyone not active who still has a punch or leave activity overlapping this month: approved, pending, or rejected)
              · Punch rows: {details.length}. Leave counts are weekdays overlapping this calendar month only.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end shrink-0 w-full sm:w-auto">
            <Suspense
              fallback={
                <div
                  className="h-9 min-h-[2.25rem] w-full sm:w-64 rounded-md bg-ink-100 animate-pulse"
                  aria-hidden
                />
              }
            >
              <ReportMonthNav
                year={year}
                month={month}
                yearMin={2020}
                yearMax={2035}
                endSlot={
                  !isViewingCurrentMonth ? (
                    <Button variant="ghost" size="sm" className="h-9 text-xs shrink-0" asChild>
                      <Link href="/admin/attendance-report">This month</Link>
                    </Button>
                  ) : null
                }
              />
            </Suspense>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-ink-100 bg-ink-50/50 px-4 py-3">
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Σ Present days</div>
              <div className="text-xl font-bold text-ink-800">{totalPresent}</div>
              <div className="text-[11px] text-ink-400 mt-1">Days with a check-in/out (excludes absence-only Bio rows)</div>
            </div>
            <div className="rounded-lg border border-ink-100 bg-ink-50/50 px-4 py-3">
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Summary CSV</div>
              <div className="text-sm text-ink-600 mt-1">One row per active employee — punches, approved-leave totals by type, pending WD, and rejected WD.</div>
            </div>
            <div className="rounded-lg border border-ink-100 bg-ink-50/50 px-4 py-3">
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Detail CSV</div>
              <div className="text-sm text-ink-600 mt-1">One row per attendance row: DD-MM-YYYY, IST times, hours, biometric device code (when sent), note.</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-ink-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/80 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Dept</th>
                  <th className="px-4 py-3 text-center">WD in month</th>
                  <th className="px-4 py-3 text-center">Present</th>
                  <th className="px-4 py-3 text-center">WFH</th>
                  <th className="px-4 py-3 text-center" title="Sum of casual + sick + unpaid + other paid approved leave weekdays this month">
                    Σ appr. leave
                  </th>
                  <th className="px-4 py-3 text-center" title="Leave requests still pending manager approval">
                    Pending WD
                  </th>
                  <th className="px-4 py-3 text-center" title="Weekdays on requests declined by approver (REJECTED)">
                    Rejected WD
                  </th>
                  <th className="px-4 py-3 text-center">Casual L</th>
                  <th className="px-4 py-3 text-center">Sick L</th>
                  <th className="px-4 py-3 text-center">Unpaid L</th>
                  <th
                    className="px-4 py-3 text-center"
                    title={`Mon–Sat punch days (Sun off): check-in (IST) strictly after ${String(REPORT_LATE_AFTER_IST.hour).padStart(2, "0")}:${String(REPORT_LATE_AFTER_IST.minute).padStart(2, "0")}`}
                  >
                    Late
                  </th>
                  <th
                    className="px-4 py-3 text-center"
                    title={`Mon–Sat punch days (Sun off): both punches, hours ≥ ${REPORT_MIN_HOURS_FOR_HALF_DAY} and &lt; ${REPORT_HALF_DAY_IF_HOURS_BELOW}`}
                  >
                    Half day
                  </th>
                  <th
                    className="px-4 py-3 text-center"
                    title={`⌊late days ÷ ${REPORT_LATES_PER_HALF_DAY}⌋ — each unit counts as ½ day toward deductions`}
                  >
                    ½ from lates
                  </th>
                  <th
                    className="px-4 py-3 text-center font-semibold text-ink-600"
                    title="Unpaid leave (weekdays) + ½ × punch half-days + ½ × half-units from lates — full-day units"
                  >
                    Deduction
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {summaries.map((r) => {
                  const leaveWd =
                    r.leaveCasualWd + r.leaveSickWd + r.leaveUnpaidWd + r.leaveOtherPaidWd;
                  return (
                    <tr key={r.userId} className="hover:bg-ink-50/40">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-ink-800">{r.name || "—"}</div>
                        <div className="text-xs text-ink-400">{r.email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-ink-600">{r.department ?? "—"}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.workingWeekdaysInMonth}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-ink-800">{r.presentDays}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.wfhDays}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{leaveWd}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.leavePendingWd}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.leaveRejectedWd}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.leaveCasualWd}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.leaveSickWd}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.leaveUnpaidWd}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.lateDays}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.halfDays}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.lateHalfEquiv}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums font-semibold text-ink-800">
                        {r.deductionDays % 1 === 0 ? r.deductionDays : r.deductionDays.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-400">
            Σ appr. leave is the total approved leave weekdays (casual + sick + unpaid + other paid)—not a duplicate of casual. Pending WD is weekdays on status PENDING; Rejected WD is weekdays on status REJECTED (declined by approver). CANCELLED is excluded from both. Menstrual / bereavement / wedding / earned leave weekdays roll into “other paid” in the CSV. Times in detail export use Asia/Kolkata; the date column is <strong className="font-medium text-ink-500">DD-MM-YYYY</strong> (UTC calendar day, matches CSV import).{" "}
            <strong className="font-medium text-ink-500">Late</strong> counts Mon–Sat punch rows (Sun off) where IST check-in is after{" "}
            {String(REPORT_LATE_AFTER_IST.hour).padStart(2, "0")}:{String(REPORT_LATE_AFTER_IST.minute).padStart(2, "0")}.{" "}
            <strong className="font-medium text-ink-500">Half day</strong> counts Mon–Sat rows (Sun off) with both punches and hours ≥ {REPORT_MIN_HOURS_FOR_HALF_DAY} and &lt; {REPORT_HALF_DAY_IF_HOURS_BELOW}.{" "}
            <strong className="font-medium text-ink-500">½ from lates</strong> is ⌊Late ÷ {REPORT_LATES_PER_HALF_DAY}⌋ (every {REPORT_LATES_PER_HALF_DAY} lates = one half-day unit).{" "}
            <strong className="font-medium text-ink-500">Deduction</strong> (full-day units) = unpaid leave weekdays + ½ × half-day instances + ½ × ½-from-lates. Paid leave types are not in this total.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
