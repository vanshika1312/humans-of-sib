import { utcCalendarDateWithIstClock } from "@/lib/calendar-date";

/** Standard “full day present” punches applied when a regularisation is approved as markFullDayPresent (IST). */
export const FULL_DAY_PRESENT_CHECK_IN_IST = { hour: 10, minute: 0 } as const;
export const FULL_DAY_PRESENT_CHECK_OUT_IST = { hour: 19, minute: 30 } as const;

export function fullDayPresentCheckInOut(dateUtcMidnight: Date): { checkIn: Date; checkOut: Date } {
  return {
    checkIn: utcCalendarDateWithIstClock(
      dateUtcMidnight,
      FULL_DAY_PRESENT_CHECK_IN_IST.hour,
      FULL_DAY_PRESENT_CHECK_IN_IST.minute,
    ),
    checkOut: utcCalendarDateWithIstClock(
      dateUtcMidnight,
      FULL_DAY_PRESENT_CHECK_OUT_IST.hour,
      FULL_DAY_PRESENT_CHECK_OUT_IST.minute,
    ),
  };
}
