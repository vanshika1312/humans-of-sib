import {
  utcMonthBounds,
  utcCalendarMidnight,
  workingDaysInclusiveUtcCalendar,
} from "@/lib/calendar-date";
import { getHalfYearPeriod } from "@/lib/leave-policy";
import type { AttendanceTab } from "./AttendanceTabNav";

export type AttendancePageQs = {
  leaveApplyError?: string;
  leaveApprovalError?: string;
  year?: string;
  month?: string;
  tab?: string;
};

function clampViewYear(y: number): number {
  if (!Number.isFinite(y)) return new Date().getFullYear();
  return Math.min(2100, Math.max(2000, Math.trunc(y)));
}

function clampViewMonth(m: number): number {
  if (!Number.isFinite(m)) return new Date().getMonth() + 1;
  return Math.min(12, Math.max(1, Math.trunc(m)));
}

export function deriveAttendanceRouteState(qs: Pick<AttendancePageQs, "tab" | "year" | "month">) {
  const activeTab: AttendanceTab = qs.tab === "requests" ? "requests" : "attendance";
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

  return {
    activeTab,
    today,
    viewYear,
    viewMonth,
    viewMonthStart,
    viewMonthEnd,
    todayUtcCal,
    isViewingCurrentMonth,
    workingDaysForMonthRate,
    calendarMonthStart,
    leavePeriodYear,
    leaveHalf,
  };
}
