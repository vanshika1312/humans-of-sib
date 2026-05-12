import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { manageableEmployeesWhere, canApproveForEmployee, type AttendanceApproverContext } from "@/lib/attendance-scope";
import {
  casualEntitled,
  casualRemaining,
  getHalfYearPeriod,
  isOnProbation,
  sickEntitledPerHalf,
  sickRemaining,
  workingDaysByHalfYearForLeave,
} from "@/lib/leave-policy";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select, Label, Textarea } from "@/components/ui/input";
import { formatDate, formatTime } from "@/lib/utils";
import {
  formatCalendarDate,
  isUtcCalendarWorkingDay,
  utcMonthBounds,
  utcCalendarMidnight,
  workingDaysInclusiveUtcCalendar,
  workingWeekdaysInUtcMonth,
} from "@/lib/calendar-date";
import { sickLeaveMedicalProofRequired } from "@/lib/sick-leave-medical-proof";
import {
  leaveRequestsAllowInsufficientPaidBalance,
  paidLeaveApproverBalancePreview,
} from "@/lib/leave-balance-guard";
import Link from "next/link";
import { ReportMonthNav } from "@/components/report-month-nav";
import { Suspense } from "react";
import {
  submitCheckInForm,
  submitCheckOut,
  ensureLeaveBalanceRow,
  reviewRegularisationForm,
  submitLeaveRequestForm,
  reviewLeaveForm,
  attachSickLeaveMedicalProofForm,
} from "./actions";
import { RegularisationRequestForm } from "./_components/RegularisationRequestForm";
import { AttendanceTabNav, type AttendanceTab } from "./_components/AttendanceTabNav";
import {
  YourLogMonthDashboard,
  type YourLogDayCell,
  type YourLogDayDetail,
} from "./_components/YourLogMonthDashboard";
import {
  payrollReportLateFlag,
  payrollReportHalfDayFlag,
  REPORT_HALF_DAY_IF_HOURS_BELOW,
  REPORT_MIN_HOURS_FOR_HALF_DAY,
} from "@/lib/payroll-attendance-report";

const FULL_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
type AttendanceMode = "OFFICE" | "WFH";

function modeStyle(mode: AttendanceMode) {
  if (mode === "WFH") return { bg: "bg-amber-100 text-amber-700", pill: "bg-amber-50 text-amber-700", label: "🏠 WFH" };
  return { bg: "bg-sky-100 text-sky-700", pill: "bg-sky-50 text-sky-700", label: "🏢 Office" };
}

function sourceBadgeTone(src: string): "sky" | "sun" | "orange" | "ink" {
  if (src === "BIOMETRIC") return "orange";
  if (src === "REGULARISED") return "sun";
  return "sky";
}

function sourceShort(src: string) {
  if (src === "BIOMETRIC") return "Bio";
  if (src === "REGULARISED") return "Reg";
  return "App";
}

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/** Y-M-D for UTC calendar day (matches @db.Date attendance rows). */
function utcIsoDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function leaveApprovalsBalanceLabel(type: string): "sick" | "casual paid" {
  return type === "SICK" ? "sick" : "casual paid";
}

function clampViewYear(y: number): number {
  if (!Number.isFinite(y)) return new Date().getFullYear();
  return Math.min(2100, Math.max(2000, Math.trunc(y)));
}

function clampViewMonth(m: number): number {
  if (!Number.isFinite(m)) return new Date().getMonth() + 1;
  return Math.min(12, Math.max(1, Math.trunc(m)));
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    leaveApplyError?: string;
    leaveApprovalError?: string;
    year?: string;
    month?: string;
    tab?: string;
  }>;
}) {
  const session = await auth();
  const qs = await searchParams;
  const activeTab: AttendanceTab = qs.tab === "requests" ? "requests" : "attendance";
  const me = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    select: {
      id: true,
      name: true,
      role: true,
      joinedAt: true,
      probationEndsAt: true,
      headedDept: { select: { id: true } },
    },
  });
  if (!me) return null;

  const viewerCtx: AttendanceApproverContext = {
    id: me.id,
    role: me.role,
    headedDeptId: me.headedDept?.id ?? null,
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yRaw = parseInt(String(qs.year ?? ""), 10);
  const mRaw = parseInt(String(qs.month ?? ""), 10);
  const viewYear = clampViewYear(Number.isFinite(yRaw) ? yRaw : today.getFullYear());
  const viewMonth = clampViewMonth(Number.isFinite(mRaw) ? mRaw : today.getMonth() + 1);
  const { start: viewMonthStart, end: viewMonthEnd } = utcMonthBounds(viewYear, viewMonth);
  const todayUtcCal = utcCalendarMidnight(new Date());
  const isViewingCurrentMonth =
    viewYear === todayUtcCal.getUTCFullYear() && viewMonth === todayUtcCal.getUTCMonth() + 1;
  const ratePeriodEnd =
    isViewingCurrentMonth && todayUtcCal.getTime() <= viewMonthEnd.getTime() ? todayUtcCal : viewMonthEnd;
  const workingDaysForMonthRate = workingDaysInclusiveUtcCalendar(viewMonthStart, ratePeriodEnd);
  const calendarMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  calendarMonthStart.setHours(0, 0, 0, 0);
  const { periodYear: leavePeriodYear, half: leaveHalf } = getHalfYearPeriod(today);

  const isApprover = ["MANAGER", "DEPT_HEAD", "HR", "CEO", "ADMIN"].includes(me.role);

  await ensureLeaveBalanceRow(me.id, today);

  const biometricConfigured = !!process.env.BIOMETRIC_WEBHOOK_SECRET;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    "";

  const [
    todayRecord,
    monthRecords,
    leaveBalance,
    myRegularisations,
    myLeaveRequests,
    pendingRegularisationsAll,
    pendingLeavesAll,
  ] = await Promise.all([
    prisma.attendance.findUnique({
      where: { userId_date: { userId: me.id, date: today } },
    }),
    prisma.attendance.findMany({
      where: { userId: me.id, date: { gte: viewMonthStart, lte: viewMonthEnd } },
      orderBy: { date: "desc" },
    }),
    prisma.leaveBalance.findUnique({
      where: {
        userId_periodYear_half: {
          userId: me.id,
          periodYear: leavePeriodYear,
          half: leaveHalf,
        },
      },
    }),
    prisma.regularisationRequest.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.leaveRequest.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    isApprover
      ? prisma.regularisationRequest.findMany({
          where: { status: "PENDING" },
          include: {
            user: { select: { id: true, name: true, image: true, managerId: true, departmentId: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    isApprover
      ? prisma.leaveRequest.findMany({
          where: { status: "PENDING" },
          include: {
            user: { select: { id: true, name: true, image: true, managerId: true, departmentId: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const pendingRegularisations = pendingRegularisationsAll.filter((r) =>
    canApproveForEmployee(viewerCtx, r.user),
  );
  const pendingLeaves = pendingLeavesAll.filter((r) => canApproveForEmployee(viewerCtx, r.user));

  const myLeaveRows = await Promise.all(
    myLeaveRequests.map(async (r) => {
      if (r.type !== "SICK" || r.status !== "PENDING") {
        return { ...r, sickProofRequired: false, sickProofIncomplete: false as boolean };
      }
      const sickProofRequired = await sickLeaveMedicalProofRequired(me.id, r.startDate, r.endDate);
      const hasProof = Boolean(r.medicalProofUrl?.trim());
      return { ...r, sickProofRequired, sickProofIncomplete: sickProofRequired && !hasProof };
    }),
  );

  const pendingLeaveRows = await Promise.all(
    pendingLeaves.map(async (r) => {
      const ledgerDebitDaysDefault =
        r.type === "UNPAID"
          ? null
          : [...workingDaysByHalfYearForLeave(r.startDate, r.endDate, r.isHalfDay).values()].reduce((a, b) => a + b, 0);

      const balancePreview = await paidLeaveApproverBalancePreview({
        userId: r.userId,
        type: r.type,
        startDate: r.startDate,
        endDate: r.endDate,
        isHalfDay: r.isHalfDay,
      });
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

  let teamToday: {
    id: string;
    name: string | null;
    image: string | null;
    dept: string | null;
    city: string | null;
    record: { mode: AttendanceMode; checkIn: Date | null; checkOut: Date | null } | null;
  }[] = [];

  let teamMonthly: {
    id: string;
    name: string | null;
    image: string | null;
    dept: string | null;
    present: number;
    office: number;
    wfh: number;
    ratePct: number;
    manual: number;
    biometric: number;
    regularised: number;
    lateDays: number;
    lateDatesShort: string;
    halfDays: number;
    halfDatesShort: string;
  }[] = [];

  if (isApprover) {
    const teamWhere = manageableEmployeesWhere(viewerCtx);
    const teamUsers = await prisma.user.findMany({
      where: teamWhere,
      select: {
        id: true,
        name: true,
        image: true,
        department: { select: { name: true } },
        city:       { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
    const teamIds = teamUsers.map((u) => u.id);

    const [filteredTodayRecs, filteredMonthRecs] =
      teamIds.length === 0
        ? [[], []]
        : await Promise.all([
            prisma.attendance.findMany({ where: { date: today, userId: { in: teamIds } } }),
            prisma.attendance.findMany({
              where: { date: { gte: viewMonthStart, lte: viewMonthEnd }, userId: { in: teamIds } },
            }),
          ]);

    const todayMap = new Map(filteredTodayRecs.map((r) => [r.userId, r]));
    teamToday = teamUsers.map((u) => {
      const rec = todayMap.get(u.id);
      return {
        id: u.id,
        name: u.name,
        image: u.image,
        dept: u.department?.name ?? null,
        city: u.city?.name ?? null,
        record: rec
          ? { mode: rec.mode as AttendanceMode, checkIn: rec.checkIn, checkOut: rec.checkOut }
          : null,
      };
    });

    const monthlyByUser = new Map<string, typeof filteredMonthRecs>();
    for (const r of filteredMonthRecs) {
      if (!monthlyByUser.has(r.userId)) monthlyByUser.set(r.userId, []);
      monthlyByUser.get(r.userId)!.push(r);
    }

    teamMonthly = teamUsers.map((u) => {
      const recs = monthlyByUser.get(u.id) ?? [];
      const present = recs.length;
      const manual = recs.filter((r) => r.source === "MANUAL").length;
      const biometric = recs.filter((r) => r.source === "BIOMETRIC").length;
      const regularised = recs.filter((r) => r.source === "REGULARISED").length;
      const ratePct =
        workingDaysForMonthRate > 0 ? Math.min(100, Math.round((present / workingDaysForMonthRate) * 100)) : 0;
      const lateRecs = recs
        .filter((r) => payrollReportLateFlag(r.checkIn, r.date))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      const lateDays = lateRecs.length;
      const lateDatesShort =
        lateRecs.length === 0
          ? ""
          : lateRecs
              .map((r) => formatDate(r.date, { day: "numeric", month: "short" }))
              .join(", ");
      const halfRecs = recs
        .filter((r) => payrollReportHalfDayFlag(r.checkIn, r.checkOut, r.date))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
      const halfDays = halfRecs.length;
      const halfDatesShort =
        halfRecs.length === 0
          ? ""
          : halfRecs
              .map((r) => formatDate(r.date, { day: "numeric", month: "short" }))
              .join(", ");
      return {
        id: u.id,
        name: u.name,
        image: u.image,
        dept: u.department?.name ?? null,
        present,
        office: recs.filter((r) => r.mode === "OFFICE").length,
        wfh: recs.filter((r) => r.mode === "WFH").length,
        ratePct,
        manual,
        biometric,
        regularised,
        lateDays,
        lateDatesShort,
        halfDays,
        halfDatesShort,
      };
    });
  }

  const checkedIn = teamToday.filter((u) => u.record !== null);
  const notYet    = teamToday.filter((u) => u.record === null);

  const onProbationLeave = isOnProbation(me.probationEndsAt, today);
  const casualUsed = leaveBalance?.casualUsed ?? 0;
  const sickUsed = leaveBalance?.sickUsed ?? 0;
  const casualEntitledNow = casualEntitled(me.probationEndsAt, me.joinedAt, today);
  const casualRemNow = casualRemaining({
    probationEndsAt: me.probationEndsAt,
    joinedAt: me.joinedAt,
    refDate: today,
    casualUsed,
  });
  const sickEntitledNow = sickEntitledPerHalf(me.probationEndsAt, today);
  const sickRemNow = sickRemaining({
    probationEndsAt: me.probationEndsAt,
    refDate: today,
    sickUsed,
  });
  const halfLabel =
    leaveHalf === 1 ? `Jan–Jun ${leavePeriodYear}` : `Jul–Dec ${leavePeriodYear}`;

  const myLateDaysChrono = [...monthRecords]
    .filter((r) => payrollReportLateFlag(r.checkIn, r.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const myHalfDaysChrono = [...monthRecords]
    .filter((r) => payrollReportHalfDayFlag(r.checkIn, r.checkOut, r.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const workingDaysInMonth = workingWeekdaysInUtcMonth(viewYear, viewMonth);
  const onTimeDaysCount = monthRecords.filter(
    (r) => isUtcCalendarWorkingDay(r.date) && !payrollReportLateFlag(r.checkIn, r.date),
  ).length;
  const halfDayDatesLabel =
    myHalfDaysChrono.length === 0
      ? ""
      : myHalfDaysChrono.map((r) => formatDate(r.date, { day: "numeric", month: "short" })).join(" · ");
  const lateRatePctYourLog =
    workingDaysInMonth > 0 ? Math.round((myLateDaysChrono.length / workingDaysInMonth) * 100) : 0;
  const yourLogMonthTitle = `${FULL_MONTHS[viewMonth - 1].toUpperCase()} ${viewYear} — DAILY STATUS`;
  const yourLogMonthYearLabel = formatDate(new Date(Date.UTC(viewYear, viewMonth - 1, 1)), {
    month: "short",
    year: "numeric",
  });

  const recordByIso = new Map(monthRecords.map((r) => [utcIsoDateKey(r.date), r] as const));

  function toYourLogDetail(r: (typeof monthRecords)[number]): YourLogDayDetail {
    return {
      id: r.id,
      dateIso: utcIsoDateKey(r.date),
      checkInIso: r.checkIn?.toISOString() ?? null,
      checkOutIso: r.checkOut?.toISOString() ?? null,
      mode: r.mode as AttendanceMode,
      source: r.source,
      note: r.note ?? null,
      location: r.location ?? null,
      biometricCode: r.biometricCode ?? null,
      late: payrollReportLateFlag(r.checkIn, r.date),
      half: payrollReportHalfDayFlag(r.checkIn, r.checkOut, r.date),
    };
  }

  const { start: calMonthStart, end: calMonthEnd } = utcMonthBounds(viewYear, viewMonth);
  const lastCalDay = calMonthEnd.getUTCDate();
  const firstDow = calMonthStart.getUTCDay();
  const mondayOffset = (firstDow + 6) % 7;
  const yourLogCells: YourLogDayCell[] = [];
  for (let i = 0; i < mondayOffset; i++) {
    yourLogCells.push({ kind: "pad" });
  }
  for (let d = 1; d <= lastCalDay; d++) {
    const date = new Date(Date.UTC(viewYear, viewMonth - 1, d));
    const iso = utcIsoDateKey(date);
    const rec = recordByIso.get(iso) ?? null;
    const isOff = !isUtcCalendarWorkingDay(date);
    let kind: YourLogDayCell["kind"];
    if (isOff) {
      kind = "off";
    } else if (!rec) {
      kind = "empty";
    } else {
      const late = payrollReportLateFlag(rec.checkIn, rec.date);
      const half = payrollReportHalfDayFlag(rec.checkIn, rec.checkOut, rec.date);
      if (half) kind = "half";
      else if (late) kind = "late";
      else kind = "on_time";
    }
    const detail = rec ? toYourLogDetail(rec) : null;
    yourLogCells.push({ kind, day: d, iso, detail });
  }

  const yourLogWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

  return (
    <div className="space-y-6">
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

      {(qs.leaveApplyError === "insufficient_balance" ||
        qs.leaveApplyError === "medical_proof") && (
        <Card className="border-orange-300 bg-orange-50/90">
          <CardContent className="pt-4 pb-4 text-sm text-orange-950">
            {qs.leaveApplyError === "insufficient_balance" ? (
              <p>
                <span className="font-semibold">Request not submitted.</span> Policy mode requires enough remaining
                paid leave for the weekdays in your selected range (or choose Unpaid). Shorten the range or ask HR about
                your balance.
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

      {activeTab === "attendance" && (
        <>
      {/* ── Today ───────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="p-5 md:p-6 brand-gradient text-white">
          <div className="text-sm opacity-80 uppercase tracking-wide font-medium">
            {formatDate(today, { weekday: "long" })}
          </div>
          <div className="text-2xl md:text-3xl font-bold">{formatDate(today)}</div>
        </div>
        <CardContent className="pt-5">
          {todayRecord?.checkIn ? (
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge tone="green">Checked in {formatTime(todayRecord.checkIn)}</Badge>
                <Badge tone={todayRecord.mode === "WFH" ? "sun" : "sky"}>
                  {modeStyle(todayRecord.mode as AttendanceMode).label}
                </Badge>
                <Badge tone={sourceBadgeTone(todayRecord.source)}>{sourceShort(todayRecord.source)}</Badge>
                {todayRecord.checkOut && (
                  <Badge tone="ink">Checked out {formatTime(todayRecord.checkOut)}</Badge>
                )}
              </div>
              {todayRecord.note && (
                <p className="text-sm text-ink-500 mt-2 italic">&quot;{todayRecord.note}&quot;</p>
              )}
              {!todayRecord.checkOut && (
                <form action={submitCheckOut} className="mt-4">
                  <Button type="submit" variant="outline">Check out →</Button>
                </form>
              )}
            </div>
          ) : (
            <form action={submitCheckInForm} className="grid md:grid-cols-[1fr,1fr,auto] gap-3 items-end">
              <div>
                <Label htmlFor="mode">Mode</Label>
                <Select id="mode" name="mode" defaultValue="OFFICE">
                  <option value="OFFICE">🏢 Office</option>
                  <option value="WFH">🏠 Work from home</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="note">Note (optional)</Label>
                <Input id="note" name="note" placeholder="What are you focused on today?" />
              </div>
              <Button type="submit" size="lg" variant="accent">Check in</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ── Biometric integration ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="size-12 rounded-xl bg-ink-50 flex items-center justify-center text-2xl shrink-0">📟</div>
            <div className="flex-1 min-w-[220px] space-y-2">
              <h2 className="font-semibold text-ink-700">Biometric integration</h2>
              <p className="text-sm text-ink-500">
                Push punches from your attendance hardware via a secure webhook (
                <span className="font-medium text-ink-600">Authorization: Bearer …</span>). Send{" "}
                <code className="text-xs bg-ink-100 px-1 rounded">email</code>,{" "}
                <code className="text-xs bg-ink-100 px-1 rounded">date</code>, optional{" "}
                <code className="text-xs bg-ink-100 px-1 rounded">code</code> (P present, A absent, LT late, EL early
                leave, MO missed out, MI missed in), and times as needed. Absent days get a note from approved / pending
                / rejected leave or &quot;Uninformed absence&quot;.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge tone={biometricConfigured ? "green" : "ink"}>
                  {biometricConfigured ? "Webhook secret configured" : "Not configured"}
                </Badge>
                {!biometricConfigured && (
                  <span className="text-xs text-ink-400">
                    Set <code className="bg-ink-100 px-1 rounded">BIOMETRIC_WEBHOOK_SECRET</code> in env to enable.
                  </span>
                )}
              </div>
              {biometricConfigured && baseUrl && (
                <p className="text-xs text-ink-400 break-all">
                  Endpoint:{" "}
                  <span className="font-mono text-ink-600">{baseUrl}/api/webhooks/biometric</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
        </>
      )}

      {activeTab === "requests" && (
        <>
      {/* ── Leave bank + apply ───────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-ink-700 mb-1">Leave bank · {halfLabel}</h2>
            <p className="text-xs text-ink-400 mb-4">
              Casual accrues 1 working month at a time (unused rolls within this half). Sick: 3 per half.
              Balances reset after Jun 30 and Dec 31.
            </p>
            {onProbationLeave ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 mb-4">
                You&apos;re on probation until{" "}
                {me.probationEndsAt ? formatDate(me.probationEndsAt) : "confirmed"} — no paid casual/sick yet.
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <MiniBank
                label="Casual remaining"
                left={casualRemNow}
                total={casualEntitledNow}
                subtitle={`used ${casualUsed}`}
              />
              <MiniBank
                label="Sick remaining"
                left={sickRemNow}
                total={sickEntitledNow}
                subtitle={`used ${sickUsed}`}
              />
            </div>
            <p className="text-xs text-ink-400 mt-3">
              HR sets probation end date on your profile; splits Jun/Jul or Dec/Jan deduct from each half separately.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-ink-700 mb-4">Apply for leave</h2>
            {leaveRequestsAllowInsufficientPaidBalance() ? (
              <p className="text-xs text-ink-500 mb-3">
                Casual and sick bookings can still be submitted if you look short on days — your manager will see a balance
                warning before approving or can charge fewer weekdays.
              </p>
            ) : (
              <p className="text-xs text-ink-500 mb-3">
                Casual and sick: you must have enough remaining balance for weekdays in your date range or the submission
                is blocked — use Unpaid or shorter dates otherwise.
              </p>
            )}
            <form action={submitLeaveRequestForm} className="space-y-3">
              <div>
                <Label htmlFor="leaveType">Type</Label>
                <Select id="leaveType" name="leaveType" defaultValue="CASUAL">
                  <option value="CASUAL">Casual</option>
                  <option value="SICK">Sick</option>
                  <option value="MENSTRUAL">Menstrual</option>
                  <option value="BEREAVEMENT">Bereavement</option>
                  <option value="WEDDING">Wedding</option>
                  <option value="UNPAID">Unpaid</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="leaveStart">From</Label>
                  <Input id="leaveStart" name="leaveStart" type="date" defaultValue={isoLocal(calendarMonthStart)} required />
                </div>
                <div>
                  <Label htmlFor="leaveEnd">To</Label>
                  <Input id="leaveEnd" name="leaveEnd" type="date" defaultValue={isoLocal(today)} required />
                </div>
              </div>
              <label className="flex items-start gap-2.5 rounded-lg border border-ink-100 bg-ink-50/50 px-3 py-2.5 cursor-pointer">
                <input
                  id="leaveHalfDay"
                  name="leaveHalfDay"
                  type="checkbox"
                  value="1"
                  className="mt-0.5 size-4 rounded border-ink-200 text-sky-600"
                />
                <span className="text-sm text-ink-700">
                  <span className="font-medium">Half day</span>
                  <span className="block text-xs text-ink-500 mt-0.5">
                    Counts as <strong className="font-medium text-ink-600">0.5</strong> weekday for payroll and paid
                    leave. Use the same From/To date on a working day (Mon–Sat).
                  </span>
                </span>
              </label>
              <div>
                <Label htmlFor="leaveReason">Reason</Label>
                <Textarea id="leaveReason" name="leaveReason" placeholder="Optional context for your manager" />
              </div>
              <div>
                <Label htmlFor="medicalProofUrl">Medical document link (sick leave)</Label>
                <Input
                  id="medicalProofUrl"
                  name="medicalProofUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://… (Drive / Dropbox share link)"
                />
                <p className="text-xs text-ink-400 mt-1">
                  Required when sick leave spans <strong className="font-medium text-ink-500">2 or more working days</strong> in one
                  request, or when this request starts on the working day immediately after another{" "}
                  <strong className="font-medium text-ink-500">approved</strong> sick spell.
                </p>
              </div>
              <Button type="submit" variant="accent">Submit request</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ── Regularisation ───────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-ink-700 mb-2">Regularisation request</h2>
            <p className="text-sm text-ink-500 mb-4">
              Fix a missed or incorrect punch, or correct a day that wrongly shows late / early leave. Your manager or HR
              will approve — approved rows show as <span className="font-medium text-ink-600">Reg</span> in your log.
            </p>
            <RegularisationRequestForm defaultDateIso={isoLocal(today)} maxDateIso={isoLocal(today)} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-ink-700 mb-4">My recent requests</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">Regularisation</h3>
                {myRegularisations.length === 0 ? (
                  <p className="text-sm text-ink-400">None yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {myRegularisations.map((r) => (
                      <li key={r.id} className="text-sm flex items-start justify-between gap-2 flex-wrap">
                        <span className="text-ink-600">{formatDate(r.date)}</span>
                        <Badge tone={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "orange" : "sun"}>
                          {r.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-ink-100 pt-4">
                <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">Leave</h3>
                {myLeaveRows.length === 0 ? (
                  <p className="text-sm text-ink-400">None yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {myLeaveRows.map((r) => (
                      <li key={r.id} className="text-sm rounded-lg border border-ink-100 p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <span className="text-ink-600">
                            {r.type}
                            {r.isHalfDay ? " (half day)" : ""} · {formatCalendarDate(r.startDate)} →{" "}
                            {formatCalendarDate(r.endDate)}
                          </span>
                          <Badge tone={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "orange" : "sun"}>
                            {r.status}
                          </Badge>
                        </div>
                        {r.sickProofIncomplete && (
                          <>
                            <p className="text-xs text-orange-700">Medical document link required by policy.</p>
                            <form action={attachSickLeaveMedicalProofForm} className="flex flex-wrap gap-2 items-end">
                              <input type="hidden" name="leaveId" value={r.id} />
                              <Input name="medicalProofUrl" type="url" inputMode="url" placeholder="Proof URL" className="h-9 flex-1 min-w-[12rem]" required />
                              <Button type="submit" size="sm" variant="outline">Attach</Button>
                            </form>
                          </>
                        )}
                        {r.medicalProofUrl?.trim() && (
                          <p className="text-xs text-ink-500">
                            Proof:{" "}
                            <a href={r.medicalProofUrl.trim()} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline underline-offset-2">
                              Open link
                            </a>
                          </p>
                        )}
                        {r.status === "APPROVED" &&
                          r.type !== "UNPAID" &&
                          r.appliedLedgerDebitDays !== null &&
                          r.appliedLedgerDebitDays !== undefined && (
                            <p className="text-xs text-ink-500">
                              Deducted from {leaveApprovalsBalanceLabel(r.type)} balance:{" "}
                              <span className="font-medium text-ink-700">{r.appliedLedgerDebitDays}</span>
                              {Number(r.appliedLedgerDebitDays) === 1 ? " weekday" : " weekdays"}
                            </p>
                          )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Approvals (managers / HR / heads) ─────────────────────────────────── */}
      {isApprover && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-ink-600">Approvals</h2>

          {pendingRegularisations.length === 0 && pendingLeaves.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-ink-400 text-center">No pending regularisation or leave requests in your scope.</p>
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
                        <Button type="submit" size="sm" variant="accent">Approve</Button>
                      </form>
                      <form action={reviewRegularisationForm} className="flex gap-2 items-end flex-wrap">
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="reviewAction" value="reject" />
                        <Input name="reviewNote" placeholder="Note (optional)" className="h-9 w-44" />
                        <Button type="submit" size="sm" variant="outline">Reject</Button>
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
                      {r.incompleteMedical && (
                        <Badge tone="orange">Medical proof missing</Badge>
                      )}
                    </div>
                    <p className="text-sm text-ink-600">
                      {formatCalendarDate(r.startDate)} → {formatCalendarDate(r.endDate)}
                    </p>
                    {r.reason && <p className="text-sm text-ink-500 italic">&quot;{r.reason}&quot;</p>}
                    {r.medicalProofUrl?.trim() && (
                      <p className="text-xs text-ink-500">
                        Medical proof:{" "}
                        <a href={r.medicalProofUrl.trim()} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline underline-offset-2">
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
                        person&apos;s remaining {leaveApprovalsBalanceLabel(r.type)} days. Approve anyway by lowering{" "}
                        &quot;Days to charge&quot; below (or reject the request).
                      </div>
                    ) : null}
                    {r.ledgerDebitDaysDefault !== null && (
                      <div className="rounded-md bg-ink-50 px-3 py-2 space-y-1">
                        <p className="text-[11px] text-ink-600">
                          Default ledger charge ·{" "}
                          <span className="font-medium text-ink-800">
                            {r.ledgerDebitDaysDefault}{" "}
                            {leaveApprovalsBalanceLabel(r.type)} weekday
                            {Number(r.ledgerDebitDaysDefault) === 1 ? "" : "s"}
                          </span>
                        </p>
                        <p className="text-[10px] text-ink-400">
                          Approve uses this total unless you enter a smaller number below (allocated across policy halves proportionally).
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
                        <Button type="submit" size="sm" variant="outline">Reject</Button>
                      </form>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
        </>
      )}

      {activeTab === "attendance" && (
        <>
      {/* ── Monthly log ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-sm font-semibold text-ink-600">
            {FULL_MONTHS[viewMonth - 1]} {viewYear} · Your log
          </h2>
          <div className="flex flex-col gap-2 sm:items-end">
            <Suspense
              fallback={
                <div
                  className="h-9 min-h-[2.25rem] w-full max-w-[22rem] rounded-md bg-ink-100 animate-pulse"
                  aria-hidden
                />
              }
            >
              <ReportMonthNav
                year={viewYear}
                month={viewMonth}
                yearMin={2000}
                yearMax={2100}
                endSlot={
                  !isViewingCurrentMonth ? (
                    <Button variant="ghost" size="sm" className="h-9 text-xs" asChild>
                      <Link href="/attendance?tab=attendance">This month</Link>
                    </Button>
                  ) : null
                }
              />
            </Suspense>
          </div>
        </div>
        <Card>
          <CardContent className="pt-4">
            {monthRecords.length === 0 ? (
              <p className="text-sm text-ink-500 text-center py-2 mb-4 border-b border-ink-100 pb-4">
                {isViewingCurrentMonth
                  ? "No attendance yet this month — grid below shows working days; check in above to fill it in."
                  : "No attendance recorded — open a day to confirm, or pick another month."}
              </p>
            ) : null}
            <YourLogMonthDashboard
              monthTitle={yourLogMonthTitle}
              workingDaysInMonth={workingDaysInMonth}
              lateCount={myLateDaysChrono.length}
              onTimeCount={onTimeDaysCount}
              halfDayCount={myHalfDaysChrono.length}
              halfDayDatesLabel={halfDayDatesLabel}
              lateRatePct={lateRatePctYourLog}
              monthYearLabel={yourLogMonthYearLabel}
              weekdays={yourLogWeekdays}
              cells={yourLogCells}
              lateArrivalsReport={myLateDaysChrono.map(toYourLogDetail)}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Team dashboard (scoped) ───────────────────────────────────────────── */}
      {isApprover && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-ink-600 mb-3">
              Team today · {checkedIn.length} checked in · {notYet.length} not yet
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <div className="px-4 py-3 border-b border-ink-100">
                  <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                    Checked In ({checkedIn.length})
                  </span>
                </div>
                <CardContent className="pt-3 pb-4">
                  {checkedIn.length === 0 ? (
                    <p className="text-sm text-ink-400">No one yet</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {checkedIn.map((u) => {
                        const s = modeStyle(u.record!.mode);
                        const ri = u.record!.checkIn;
                        const ro = u.record!.checkOut;
                        const sub = u.dept ?? u.city;
                        return (
                          <li key={u.id} className="flex items-center gap-2.5">
                            <Avatar src={u.image} name={u.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-ink-700 truncate">{u.name}</div>
                              <div className="text-xs text-ink-600 tabular-nums">
                                In {ri ? formatTime(ri) : "—"} · Out {ro ? formatTime(ro) : "—"}
                              </div>
                              {sub ? (
                                <div className="text-[11px] text-ink-400 truncate">{sub}</div>
                              ) : null}
                            </div>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.pill}`}>
                              {s.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <div className="px-4 py-3 border-b border-ink-100">
                  <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                    Not Checked In ({notYet.length})
                  </span>
                </div>
                <CardContent className="pt-3 pb-4">
                  {notYet.length === 0 ? (
                    <p className="text-sm text-green-600 font-medium">Everyone in scope checked in 🎉</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {notYet.map((u) => (
                        <li key={u.id} className="flex items-center gap-2.5">
                          <Avatar src={u.image} name={u.name} size="sm" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-ink-700 truncate">{u.name}</div>
                            <div className="text-xs text-ink-400">{u.dept ?? u.city ?? "—"}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink-600 mb-3">
              Team metrics — {FULL_MONTHS[viewMonth - 1]} {viewYear}
            </h2>
            <p className="text-xs text-ink-400 mb-3">
              Rate = days with a punch ÷ working weekdays{" "}
              {isViewingCurrentMonth
                ? "from the 1st through today (Mon–Sat, Sun off)"
                : "in this month (Mon–Sat, Sun off)"}
              . Bio / App / Reg =
              how those days were recorded. <span className="font-medium text-ink-500">Late</span> /{" "}
              <span className="font-medium text-ink-500">Half</span> use the same rules as the payroll report (detail
              export).
            </p>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-100 text-[10.5px] text-ink-400 uppercase tracking-wide font-semibold">
                      <th className="text-left py-3 px-5">Person</th>
                      <th className="text-left py-3 px-5">Cluster</th>
                      <th className="text-center py-3 px-3">Rate</th>
                      <th className="text-center py-3 px-3">Late</th>
                      <th
                        className="text-center py-3 px-3"
                        title={`Mon–Sat, Sun off: both punches, hours &gt; ${REPORT_MIN_HOURS_FOR_HALF_DAY} and &lt; ${REPORT_HALF_DAY_IF_HOURS_BELOW}`}
                      >
                        Half
                      </th>
                      <th className="text-center py-3 px-3">Present</th>
                      <th className="text-center py-3 px-3">🏢</th>
                      <th className="text-center py-3 px-3">🏠</th>
                      <th className="text-center py-3 px-3">App</th>
                      <th className="text-center py-3 px-3">Bio</th>
                      <th className="text-center py-3 px-3">Reg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {teamMonthly.map((u) => (
                      <tr key={u.id} className="hover:bg-ink-50/50 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar src={u.image} name={u.name} size="sm" />
                            <span className="font-medium text-ink-700">{u.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-ink-500">{u.dept ?? "—"}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-sky-700">{u.ratePct}%</td>
                        <td className="py-3.5 px-3 text-center align-top">
                          {u.lateDays > 0 ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-orange-700">{u.lateDays}</span>
                              <div className="text-[10px] text-ink-500 leading-snug max-w-[10rem] mx-auto whitespace-normal">
                                {u.lateDatesShort}
                              </div>
                            </div>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center align-top">
                          {u.halfDays > 0 ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-amber-800">{u.halfDays}</span>
                              <div className="text-[10px] text-ink-500 leading-snug max-w-[10rem] mx-auto whitespace-normal">
                                {u.halfDatesShort}
                              </div>
                            </div>
                          ) : (
                            <span className="text-ink-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center font-semibold text-ink-700">{u.present}</td>
                        <td className="py-3.5 px-3 text-center text-sky-600">{u.office || "—"}</td>
                        <td className="py-3.5 px-3 text-center text-amber-600">{u.wfh || "—"}</td>
                        <td className="py-3.5 px-3 text-center text-ink-500">{u.manual || "—"}</td>
                        <td className="py-3.5 px-3 text-center text-ink-500">{u.biometric || "—"}</td>
                        <td className="py-3.5 px-3 text-center text-ink-500">{u.regularised || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function MiniBank({ label, left, total, subtitle }: {
  label: string;
  left: number;
  total: number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg bg-ink-50 p-3">
      <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-ink-700">{Math.max(0, left)}</div>
      <div className="text-[11px] text-ink-400">
        of {total} day{total !== 1 ? "s" : ""} accrued this half
        {subtitle ? ` · ${subtitle}` : ""}
      </div>
    </div>
  );
}
