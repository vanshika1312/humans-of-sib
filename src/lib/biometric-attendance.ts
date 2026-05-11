import { prisma } from "@/lib/prisma";
import { utcCalendarMidnight } from "@/lib/calendar-date";
import type { BiometricAttendanceCode, LeaveType } from "@/generated/prisma";

export type BiometricVendorCode = "P" | "A" | "LT" | "EL" | "MO" | "MI";

/** Maps device codes (P, A, LT, …) to stored enum; unknown → null. */
export function parseBiometricVendorCode(raw: string | undefined | null): BiometricAttendanceCode | null {
  if (!raw) return null;
  switch (raw.trim().toUpperCase()) {
    case "P":
      return "PRESENT";
    case "A":
      return "ABSENT";
    case "LT":
      return "LATE_ARRIVAL";
    case "EL":
      return "EARLY_LEAVE";
    case "MO":
      return "MISSED_OUT";
    case "MI":
      return "MISSED_IN";
    default:
      return null;
  }
}

function leaveTypeLabel(t: LeaveType): string {
  const labels: Record<LeaveType, string> = {
    CASUAL: "casual",
    SICK: "sick",
    EARNED: "earned",
    UNPAID: "unpaid",
    MENSTRUAL: "menstrual",
    BEREAVEMENT: "bereavement",
    WEDDING: "wedding",
  };
  return labels[t] ?? t.toLowerCase();
}

/**
 * When the biometric marks a day absent, derive a note from overlapping leave requests
 * (approved / pending / rejected) or uninformed absence.
 */
export async function resolveBiometricAbsentDayNote(userId: string, onDate: Date): Promise<string> {
  const day = utcCalendarMidnight(onDate);
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: { not: "CANCELLED" },
      startDate: { lte: day },
      endDate: { gte: day },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true, type: true },
  });

  const approved = leaves.find((l) => l.status === "APPROVED");
  if (approved) {
    return `Absent · Approved ${leaveTypeLabel(approved.type)} leave`;
  }
  const pending = leaves.find((l) => l.status === "PENDING");
  if (pending) {
    return `Absent · Leave pending (${leaveTypeLabel(pending.type)})`;
  }
  const rejected = leaves.find((l) => l.status === "REJECTED");
  if (rejected) {
    return `Absent · Leave rejected (${leaveTypeLabel(rejected.type)}) — uninformed absence`;
  }
  return "Absent · Uninformed absence";
}

/** Payroll / summaries: absence-only biometric rows do not count as a present day. */
export function attendanceRowCountsAsPresentDay(row: {
  checkIn: Date | null;
  checkOut: Date | null;
  biometricCode: BiometricAttendanceCode | null;
}): boolean {
  if (row.biometricCode === "ABSENT") return false;
  return row.checkIn != null || row.checkOut != null;
}
