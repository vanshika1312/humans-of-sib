import { prisma } from "@/lib/prisma";
import {
  nextUtcWorkingDayAfter,
  utcCalendarMidnight,
  workingDaysInclusiveUtcCalendar,
} from "@/lib/calendar-date";

/**
 * Previous approved sick leave ends and the next working day is exactly this request’s start —
 * counts as chaining two sick avails (“together”).
 */
export async function hasApprovedSickChainedImmediatelyBefore(
  userId: string,
  newStartDate: Date,
): Promise<boolean> {
  const sd = utcCalendarMidnight(newStartDate);

  const prior = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      type: "SICK",
      status: "APPROVED",
      endDate: { lt: sd },
    },
    orderBy: { endDate: "desc" },
    select: { endDate: true },
  });

  if (!prior?.endDate) return false;

  const bridge = nextUtcWorkingDayAfter(new Date(prior.endDate));
  return bridge.getTime() === sd.getTime();
}

/** Policy: medical proof when sick spans 2+ working days OR immediately follows another approved sick spell. */
export async function sickLeaveMedicalProofRequired(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<boolean> {
  const wd = workingDaysInclusiveUtcCalendar(startDate, endDate);
  if (wd >= 2) return true;
  return hasApprovedSickChainedImmediatelyBefore(userId, startDate);
}

export function sickLeaveMedicalProofProvided(
  type: string,
  medicalProofUrl: string | null | undefined,
): boolean {
  if (type !== "SICK") return true;
  return Boolean(typeof medicalProofUrl === "string" && medicalProofUrl.trim().length > 0);
}

export async function canApproveSickLeaveWithMedicalRule(params: {
  userId: string;
  startDate: Date;
  endDate: Date;
  type: string;
  medicalProofUrl: string | null | undefined;
}): Promise<boolean> {
  if (params.type !== "SICK") return true;

  const need = await sickLeaveMedicalProofRequired(params.userId, params.startDate, params.endDate);
  if (!need) return true;

  return sickLeaveMedicalProofProvided("SICK", params.medicalProofUrl);
}
