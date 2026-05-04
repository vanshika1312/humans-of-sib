import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";

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

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const u = Date.UTC(year, month - 1 + delta, 1);
  return { year: new Date(u).getUTCFullYear(), month: new Date(u).getUTCMonth() + 1 };
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
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const totalPresent = summaries.reduce((a, r) => a + r.presentDays, 0);
  const exportBase = `/admin/attendance-report/export?year=${year}&month=${month}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance · Payroll export"
        emoji="📊"
        subtitle="Month-level punches and approved leave weekdays for every active employee — CSV for spreadsheets."
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
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{MONTHS[month - 1]} {year}</CardTitle>
            <CardDescription>
              Rows: {summaries.length} employee{summaries.length !== 1 ? "s" : ""} (everyone active, plus anyone not active who still has a punch or approved leave overlapping this month)
              · Punch rows: {details.length}. Leave counts are weekdays overlapping this calendar month only.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/attendance-report?year=${prev.year}&month=${prev.month}`}>
                <ChevronLeft className="size-4" />
                Prev
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/attendance-report?year=${next.year}&month=${next.month}`}>
                Next
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-ink-100 bg-ink-50/50 px-4 py-3">
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Σ Present days</div>
              <div className="text-xl font-bold text-ink-800">{totalPresent}</div>
              <div className="text-[11px] text-ink-400 mt-1">Across everyone (rows with a punch)</div>
            </div>
            <div className="rounded-lg border border-ink-100 bg-ink-50/50 px-4 py-3">
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Summary CSV</div>
              <div className="text-sm text-ink-600 mt-1">One row per active employee — counts + approved leave weekdays by type.</div>
            </div>
            <div className="rounded-lg border border-ink-100 bg-ink-50/50 px-4 py-3">
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Detail CSV</div>
              <div className="text-sm text-ink-600 mt-1">One row per punch with IST times and hours (when checkout exists).</div>
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
                  <th className="px-4 py-3 text-center">Leave WD</th>
                  <th className="px-4 py-3 text-center">Casual L</th>
                  <th className="px-4 py-3 text-center">Sick L</th>
                  <th className="px-4 py-3 text-center">Unpaid L</th>
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
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.leaveCasualWd}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.leaveSickWd}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums">{r.leaveUnpaidWd}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-400">
            Menstrual / bereavement / wedding / earned leave weekdays roll into “other paid” in the CSV. Times in detail export use Asia/Kolkata; calendar dates use UTC date stored with attendance (consistent with the attendance module).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
