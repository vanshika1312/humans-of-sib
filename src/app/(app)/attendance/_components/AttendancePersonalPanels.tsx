import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import {
  casualEntitled,
  casualRemaining,
  isOnProbation,
  sickEntitledPerHalf,
  sickRemaining,
} from "@/lib/leave-policy";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label, Textarea } from "@/components/ui/input";
import { formatDate, formatTime } from "@/lib/utils";
import {
  formatCalendarDate,
  isUtcCalendarWorkingDay,
  utcMonthBounds,
  workingWeekdaysInUtcMonth,
} from "@/lib/calendar-date";
import { sickLeaveMedicalProofRequired } from "@/lib/sick-leave-medical-proof";
import { leaveRequestsAllowInsufficientPaidBalance } from "@/lib/leave-balance-guard";
import Link from "next/link";
import { ReportMonthNav } from "@/components/report-month-nav";
import { Suspense } from "react";
import {
  submitCheckInForm,
  submitCheckOut,
  ensureLeaveBalanceRow,
  submitLeaveRequestForm,
  attachSickLeaveMedicalProofForm,
} from "../actions";
import { RegularisationRequestForm } from "./RegularisationRequestForm";
import {
  YourLogMonthDashboard,
  type YourLogDayCell,
  type YourLogDayDetail,
} from "./YourLogMonthDashboard";
import {
  payrollReportLateFlag,
  payrollReportHalfDayFlag,
} from "@/lib/payroll-attendance-report";
import type { AttendancePageQs } from "./attendance-route-state";
import { deriveAttendanceRouteState } from "./attendance-route-state";
import {
  FULL_MONTHS,
  type AttendanceMode,
  isoLocal,
  leaveApprovalsBalanceLabel,
  MiniBank,
  modeStyle,
  sourceBadgeTone,
  sourceShort,
  utcIsoDateKey,
} from "./attendance-shared";

export async function AttendancePersonalPanels({ qs }: { qs: AttendancePageQs }) {
  const me = await requireAppViewer();
  if (!me) return null;

  const route = deriveAttendanceRouteState(qs);
  const {
    activeTab,
    today,
    viewYear,
    viewMonth,
    viewMonthStart,
    viewMonthEnd,
    isViewingCurrentMonth,
    calendarMonthStart,
    leavePeriodYear,
    leaveHalf,
  } = route;

  await ensureLeaveBalanceRow(me.id, today);

  const biometricConfigured = !!process.env.BIOMETRIC_WEBHOOK_SECRET;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    "";

  const [todayRecord, monthRecords, leaveBalance, myRegularisations, myLeaveRequests] = await Promise.all([
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
  ]);

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
    <>
      {activeTab === "attendance" && (
        <>
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
                      <Button type="submit" variant="outline">
                        Check out →
                      </Button>
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
                  <Button type="submit" size="lg" variant="accent">
                    Check in
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

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
                    leave, MO missed out, MI missed in), and times as needed. Absent days get a note from approved /
                    pending / rejected leave or &quot;Uninformed absence&quot;.
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
                      Endpoint: <span className="font-mono text-ink-600">{baseUrl}/api/webhooks/biometric</span>
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
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-5">
                <h2 className="font-semibold text-ink-700 mb-1">Leave bank · {halfLabel}</h2>
                <p className="text-xs text-ink-400 mb-4">
                  Casual accrues 1 working month at a time (unused rolls within this half). Sick: 3 per half. Balances
                  reset after Jun 30 and Dec 31.
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
                    Casual and sick bookings can still be submitted if you look short on days — your manager will see a
                    balance warning before approving or can charge fewer weekdays.
                  </p>
                ) : (
                  <p className="text-xs text-ink-500 mb-3">
                    Casual and sick: you must have enough remaining balance for weekdays in your date range or the
                    submission is blocked — use Unpaid or shorter dates otherwise.
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
                      <Input
                        id="leaveStart"
                        name="leaveStart"
                        type="date"
                        defaultValue={isoLocal(calendarMonthStart)}
                        required
                      />
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
                      Required when sick leave spans{" "}
                      <strong className="font-medium text-ink-500">2 or more working days</strong> in one request, or when
                      this request starts on the working day immediately after another{" "}
                      <strong className="font-medium text-ink-500">approved</strong> sick spell.
                    </p>
                  </div>
                  <Button type="submit" variant="accent">
                    Submit request
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-5">
                <h2 className="font-semibold text-ink-700 mb-2">Regularisation request</h2>
                <p className="text-sm text-ink-500 mb-4">
                  Fix a missed or incorrect punch, or correct a day that wrongly shows late / early leave. Your manager or
                  HR will approve — approved rows show as <span className="font-medium text-ink-600">Reg</span> in your
                  log.
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
                                  <Input
                                    name="medicalProofUrl"
                                    type="url"
                                    inputMode="url"
                                    placeholder="Proof URL"
                                    className="h-9 flex-1 min-w-[12rem]"
                                    required
                                  />
                                  <Button type="submit" size="sm" variant="outline">
                                    Attach
                                  </Button>
                                </form>
                              </>
                            )}
                            {r.medicalProofUrl?.trim() && (
                              <p className="text-xs text-ink-500">
                                Proof:{" "}
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
        </>
      )}

      {activeTab === "attendance" && (
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
      )}
    </>
  );
}
