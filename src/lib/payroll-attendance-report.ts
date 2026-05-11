import { prisma } from "@/lib/prisma";
import { attendanceRowCountsAsPresentDay } from "@/lib/biometric-attendance";
import {
  isUtcCalendarWorkingDay,
  utcCalendarMidnight,
  utcMonthBounds,
  workingDaysInclusiveUtcCalendar,
  workingWeekdaysInUtcMonth,
} from "@/lib/calendar-date";

export const PAYROLL_REPORT_ROLES = ["CEO", "ADMIN", "HR"] as const;

const IST = "Asia/Kolkata";

/**
 * Attendance report — late / half-day counts (office window 10:00–19:30 IST).
 * Working week: **Monday–Saturday** (Sunday off), UTC calendar day on the stored date.
 * Late: first punch on a working day is strictly after this IST time (10:10 → on-time through 10:10, late from 10:11).
 * Half day: both punches exist, duration ≥ {@link REPORT_MIN_HOURS_FOR_HALF_DAY} and strictly below half of office hours (9.5h → {@link REPORT_HALF_DAY_IF_HOURS_BELOW}h).
 * For payroll deduction: every {@link REPORT_LATES_PER_HALF_DAY} late instances count as one additional half-day unit.
 */
export const REPORT_LATE_AFTER_IST = { hour: 10, minute: 10 } as const;
export const REPORT_HALF_DAY_IF_HOURS_BELOW = 4.75;
export const REPORT_MIN_HOURS_FOR_HALF_DAY = 0.25;
export const REPORT_LATES_PER_HALF_DAY = 3;

function istClockMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "hour") hour = parseInt(p.value, 10) || 0;
    if (p.type === "minute") minute = parseInt(p.value, 10) || 0;
  }
  return hour * 60 + minute;
}

export function payrollReportLateFlag(checkIn: Date | null, date: Date): boolean {
  if (!checkIn) return false;
  if (!isUtcCalendarWorkingDay(date)) return false;
  const cutoff = REPORT_LATE_AFTER_IST.hour * 60 + REPORT_LATE_AFTER_IST.minute;
  return istClockMinutes(checkIn) > cutoff;
}

export function payrollReportHalfDayFlag(checkIn: Date | null, checkOut: Date | null, date: Date): boolean {
  if (!checkIn || !checkOut) return false;
  if (!isUtcCalendarWorkingDay(date)) return false;
  const h = (checkOut.getTime() - checkIn.getTime()) / 3_600_000;
  return h >= REPORT_MIN_HOURS_FOR_HALF_DAY && h < REPORT_HALF_DAY_IF_HOURS_BELOW;
}

/** Half-day units earned from late arrivals (e.g. 3 lates → 1). */
export function payrollLateHalfEquivalents(lateDayCount: number): number {
  return Math.floor(lateDayCount / REPORT_LATES_PER_HALF_DAY);
}

/**
 * Combined deduction in **full-day units**: unpaid leave weekdays +
 * 0.5 × (punch half-days + half-days from lates via {@link payrollLateHalfEquivalents}).
 */
export function payrollDeductionDays(row: {
  leaveUnpaidWd: number;
  halfDays: number;
  lateDays: number;
}): number {
  const fromLates = payrollLateHalfEquivalents(row.lateDays) * 0.5;
  const raw = row.leaveUnpaidWd + row.halfDays * 0.5 + fromLates;
  return Math.round(raw * 2) / 2;
}

export function csvEscape(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function overlapWorkingWeekdays(leaveStart: Date, leaveEnd: Date, monthStart: Date, monthEnd: Date): number {
  const loMs = Math.max(utcCalendarMidnight(leaveStart).getTime(), utcCalendarMidnight(monthStart).getTime());
  const hiMs = Math.min(utcCalendarMidnight(leaveEnd).getTime(), utcCalendarMidnight(monthEnd).getTime());
  if (loMs > hiMs) return 0;
  return workingDaysInclusiveUtcCalendar(new Date(loMs), new Date(hiMs));
}

function leavePayrollBucket(type: string): "casual" | "sick" | "unpaid" | "otherPaid" {
  if (type === "UNPAID") return "unpaid";
  if (type === "SICK") return "sick";
  if (type === "CASUAL") return "casual";
  return "otherPaid";
}

export interface PayrollAttendanceSummaryRow {
  userId: string;
  email: string;
  name: string | null;
  department: string | null;
  city: string | null;
  role: string;
  employeeStatus: string;
  workingWeekdaysInMonth: number;
  presentDays: number;
  officeDays: number;
  wfhDays: number;
  sourceManual: number;
  sourceBiometric: number;
  sourceRegularised: number;
  leaveCasualWd: number;
  leaveSickWd: number;
  leaveUnpaidWd: number;
  leaveOtherPaidWd: number;
  /** Weekdays overlapping this month on requests still awaiting approval (PENDING only). */
  leavePendingWd: number;
  /** Weekdays overlapping this month on requests declined by approver (REJECTED only). */
  leaveRejectedWd: number;
  /** Working days in this month where check-in (IST) is after {@link REPORT_LATE_AFTER_IST}. */
  lateDays: number;
  /** Working days with both punches and hours in [{@link REPORT_MIN_HOURS_FOR_HALF_DAY}, {@link REPORT_HALF_DAY_IF_HOURS_BELOW}). */
  halfDays: number;
  /** floor(lateDays / REPORT_LATES_PER_HALF_DAY); each unit adds ½ day to deductionDays. */
  lateHalfEquiv: number;
  /** Unpaid leave weekdays + ½×halfDays + ½×lateHalfEquiv (full-day units). */
  deductionDays: number;
}

export interface PayrollAttendanceDetailRow {
  userId: string;
  email: string;
  name: string | null;
  department: string | null;
  city: string | null;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  mode: string;
  source: string;
  note: string | null;
  biometricCode: string | null;
  late: boolean;
  halfDay: boolean;
}

/** DD-MM-YYYY for payroll detail CSV (UTC calendar day, matches @db.Date and import format). */
function formatDetailCsvDateUtc(d: Date): string {
  const x = utcCalendarMidnight(d);
  const da = String(x.getUTCDate()).padStart(2, "0");
  const m = String(x.getUTCMonth() + 1).padStart(2, "0");
  const y = x.getUTCFullYear();
  return `${da}-${m}-${y}`;
}

function formatWeekdayShortUtc(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", timeZone: "UTC" }).format(d);
}

export function formatTimeIST(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: IST,
  }).format(d);
}

export function hoursWorkedLabel(checkIn: Date | null, checkOut: Date | null): string {
  if (!checkIn || !checkOut) return "";
  const h = (checkOut.getTime() - checkIn.getTime()) / 3_600_000;
  return h >= 0 ? h.toFixed(2) : "";
}

export async function fetchPayrollAttendanceReport(year: number, month: number): Promise<{
  summaries: PayrollAttendanceSummaryRow[];
  details: PayrollAttendanceDetailRow[];
}> {
  const { start: monthStart, end: monthEnd } = utcMonthBounds(year, month);
  const workingWeekdaysInMonth = workingWeekdaysInUtcMonth(year, month);

  const usersActive = await prisma.user.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      department: { select: { name: true } },
      city: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  const attendanceRows = await prisma.attendance.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          department: { select: { name: true } },
          city: { select: { name: true } },
        },
      },
    },
    orderBy: [{ userId: "asc" }, { date: "asc" }],
  });

  const leavesApproved = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      AND: [{ startDate: { lte: monthEnd } }, { endDate: { gte: monthStart } }],
    },
    select: { userId: true, type: true, startDate: true, endDate: true, isHalfDay: true },
  });

  const leavesPending = await prisma.leaveRequest.findMany({
    where: {
      status: "PENDING",
      AND: [{ startDate: { lte: monthEnd } }, { endDate: { gte: monthStart } }],
    },
    select: { userId: true, startDate: true, endDate: true, isHalfDay: true },
  });

  const leavesRejected = await prisma.leaveRequest.findMany({
    where: {
      status: "REJECTED",
      AND: [{ startDate: { lte: monthEnd } }, { endDate: { gte: monthStart } }],
    },
    select: { userId: true, startDate: true, endDate: true, isHalfDay: true },
  });

  const extraIds = new Set<string>();
  for (const row of attendanceRows) extraIds.add(row.userId);
  for (const lr of leavesApproved) extraIds.add(lr.userId);
  for (const lr of leavesPending) extraIds.add(lr.userId);
  for (const lr of leavesRejected) extraIds.add(lr.userId);
  const activeIds = new Set(usersActive.map((u) => u.id));
  const needExtra = [...extraIds].filter((id) => !activeIds.has(id));
  const usersExtra =
    needExtra.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: needExtra } },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            department: { select: { name: true } },
            city: { select: { name: true } },
          },
        });

  const users = [...usersActive, ...usersExtra].sort((a, b) =>
    (a.name || a.email).localeCompare(b.name || b.email),
  );

  const summaryMap = new Map<string, PayrollAttendanceSummaryRow>();
  for (const u of users) {
    summaryMap.set(u.id, {
      userId: u.id,
      email: u.email,
      name: u.name,
      department: u.department?.name ?? null,
      city: u.city?.name ?? null,
      role: u.role,
      employeeStatus: u.status,
      workingWeekdaysInMonth,
      presentDays: 0,
      officeDays: 0,
      wfhDays: 0,
      sourceManual: 0,
      sourceBiometric: 0,
      sourceRegularised: 0,
      leaveCasualWd: 0,
      leaveSickWd: 0,
      leaveUnpaidWd: 0,
      leaveOtherPaidWd: 0,
      leavePendingWd: 0,
      leaveRejectedWd: 0,
      lateDays: 0,
      halfDays: 0,
      lateHalfEquiv: 0,
      deductionDays: 0,
    });
  }

  const details: PayrollAttendanceDetailRow[] = [];

  for (const row of attendanceRows) {
    const s = summaryMap.get(row.userId);
    if (s) {
      const countsPresent = attendanceRowCountsAsPresentDay(row);
      if (countsPresent) {
        s.presentDays += 1;
        if (row.mode === "OFFICE") s.officeDays += 1;
        else if (row.mode === "WFH") s.wfhDays += 1;
      }
      if (row.source === "MANUAL") s.sourceManual += 1;
      else if (row.source === "BIOMETRIC") s.sourceBiometric += 1;
      else if (row.source === "REGULARISED") s.sourceRegularised += 1;

      const late = payrollReportLateFlag(row.checkIn, row.date);
      const halfDay = payrollReportHalfDayFlag(row.checkIn, row.checkOut, row.date);
      if (late) s.lateDays += 1;
      if (halfDay) s.halfDays += 1;
    }

    const u = row.user;
    details.push({
      userId: u.id,
      email: u.email,
      name: u.name,
      department: u.department?.name ?? null,
      city: u.city?.name ?? null,
      date: row.date,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      mode: row.mode,
      source: row.source,
      note: row.note,
      biometricCode: row.biometricCode,
      late: payrollReportLateFlag(row.checkIn, row.date),
      halfDay: payrollReportHalfDayFlag(row.checkIn, row.checkOut, row.date),
    });
  }

  for (const lr of leavesApproved) {
    let wd = overlapWorkingWeekdays(lr.startDate, lr.endDate, monthStart, monthEnd);
    if (lr.isHalfDay) wd *= 0.5;
    if (wd <= 0) continue;
    const s = summaryMap.get(lr.userId);
    if (!s) continue;
    const b = leavePayrollBucket(lr.type);
    if (b === "casual") s.leaveCasualWd += wd;
    else if (b === "sick") s.leaveSickWd += wd;
    else if (b === "unpaid") s.leaveUnpaidWd += wd;
    else s.leaveOtherPaidWd += wd;
  }

  for (const lr of leavesPending) {
    let wd = overlapWorkingWeekdays(lr.startDate, lr.endDate, monthStart, monthEnd);
    if (lr.isHalfDay) wd *= 0.5;
    if (wd <= 0) continue;
    const s = summaryMap.get(lr.userId);
    if (!s) continue;
    s.leavePendingWd += wd;
  }

  for (const lr of leavesRejected) {
    let wd = overlapWorkingWeekdays(lr.startDate, lr.endDate, monthStart, monthEnd);
    if (lr.isHalfDay) wd *= 0.5;
    if (wd <= 0) continue;
    const s = summaryMap.get(lr.userId);
    if (!s) continue;
    s.leaveRejectedWd += wd;
  }

  for (const s of summaryMap.values()) {
    s.lateHalfEquiv = payrollLateHalfEquivalents(s.lateDays);
    s.deductionDays = payrollDeductionDays(s);
  }

  const summaries = [...summaryMap.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

  return { summaries, details };
}

export function buildPayrollSummaryCsv(rows: PayrollAttendanceSummaryRow[]): string {
  const header = [
    "email",
    "name",
    "department",
    "city",
    "role",
    "employee_status",
    "working_weekdays_in_month",
    "present_days",
    "office_days",
    "wfh_days",
    "source_app_manual",
    "source_biometric",
    "source_regularised",
    "approved_leave_weekdays_total",
    "pending_leave_weekdays",
    "rejected_leave_weekdays",
    "leave_casual_weekdays",
    "leave_sick_weekdays",
    "leave_unpaid_weekdays",
    "leave_other_paid_weekdays",
    "late_days",
    "late_half_equiv_from_lates",
    "half_day_instances",
    "deduction_days",
  ].join(",");

  const lines = rows.map((r) => {
    const approvedLeaveTotal =
      r.leaveCasualWd + r.leaveSickWd + r.leaveUnpaidWd + r.leaveOtherPaidWd;
    return [
      csvEscape(r.email),
      csvEscape(r.name),
      csvEscape(r.department),
      csvEscape(r.city),
      csvEscape(r.role),
      csvEscape(r.employeeStatus),
      r.workingWeekdaysInMonth,
      r.presentDays,
      r.officeDays,
      r.wfhDays,
      r.sourceManual,
      r.sourceBiometric,
      r.sourceRegularised,
      approvedLeaveTotal,
      r.leavePendingWd,
      r.leaveRejectedWd,
      r.leaveCasualWd,
      r.leaveSickWd,
      r.leaveUnpaidWd,
      r.leaveOtherPaidWd,
      r.lateDays,
      r.lateHalfEquiv,
      r.halfDays,
      r.deductionDays,
    ].join(",");
  });

  return [header, ...lines].join("\n");
}

export function buildPayrollDetailCsv(rows: PayrollAttendanceDetailRow[]): string {
  const header = [
    "email",
    "name",
    "department",
    "city",
    "date",
    "weekday_utc",
    "check_in_ist",
    "check_out_ist",
    "hours",
    "mode",
    "source",
    "biometric_code",
    "note",
    "late",
    "half_day",
  ].join(",");

  const lines = rows.map((r) =>
    [
      csvEscape(r.email),
      csvEscape(r.name),
      csvEscape(r.department),
      csvEscape(r.city),
      csvEscape(formatDetailCsvDateUtc(r.date)),
      csvEscape(formatWeekdayShortUtc(r.date)),
      csvEscape(formatTimeIST(r.checkIn)),
      csvEscape(formatTimeIST(r.checkOut)),
      csvEscape(hoursWorkedLabel(r.checkIn, r.checkOut)),
      csvEscape(r.mode),
      csvEscape(r.source),
      csvEscape(r.biometricCode),
      csvEscape(r.note),
      r.late ? "yes" : "no",
      r.halfDay ? "yes" : "no",
    ].join(","),
  );

  return [header, ...lines].join("\n");
}
