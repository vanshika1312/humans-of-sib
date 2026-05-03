import { prisma } from "@/lib/prisma";
import { ledgerDebitSplitByHalf } from "@/lib/leave-debit-allocation";
import {
  casualRemaining,
  parseHalfKey,
  sickRemaining,
  workingDaysByHalfYear,
  workingDaysInHalf,
} from "@/lib/leave-policy";

export type PaidLeaveLedger = "casualUsed" | "sickUsed";

/** Casual-like types debit casualUsed; sick debits sickUsed; unpaid skips ledger. */
export function paidLeaveLedgerForType(type: string): PaidLeaveLedger | null {
  switch (type) {
    case "CASUAL":
    case "MENSTRUAL":
    case "BEREAVEMENT":
    case "WEDDING":
    case "EARNED":
      return "casualUsed";
    case "SICK":
      return "sickUsed";
    case "UNPAID":
      return null;
    default:
      return "casualUsed";
  }
}

/**
 * Env: set `LEAVE_ALLOW_REQUEST_WITHOUT_PAID_BALANCE=false` to reject casual/sick applications
 * when the default weekday debit would exceed remaining balance (strict mode).
 * Default (unset): allow apply; managers see a warning on approval.
 */
export function leaveRequestsAllowInsufficientPaidBalance(): boolean {
  return process.env.LEAVE_ALLOW_REQUEST_WITHOUT_PAID_BALANCE !== "false";
}

export async function leaveDebitFitsBalances(params: {
  userId: string;
  probationEndsAt: Date | null;
  joinedAt: Date;
  ledger: PaidLeaveLedger;
  startDate: Date;
  endDate: Date;
  debitByHalf: Map<string, number>;
}): Promise<boolean> {
  for (const [key, needDays] of params.debitByHalf.entries()) {
    if (needDays <= 0) continue;
    const { periodYear, half } = parseHalfKey(key);
    const bal = await prisma.leaveBalance.findUnique({
      where: { userId_periodYear_half: { userId: params.userId, periodYear, half } },
    });
    const casualUsed = bal?.casualUsed ?? 0;
    const sickUsed = bal?.sickUsed ?? 0;

    const daysInHalf = workingDaysInHalf(
      params.startDate,
      params.endDate,
      periodYear,
      half,
    );
    const refForEntitlement = daysInHalf.length ? daysInHalf[daysInHalf.length - 1]! : params.endDate;

    if (params.ledger === "sickUsed") {
      const rem = sickRemaining({
        probationEndsAt: params.probationEndsAt,
        refDate: refForEntitlement,
        sickUsed,
      });
      if (needDays > rem) return false;
    } else {
      const rem = casualRemaining({
        probationEndsAt: params.probationEndsAt,
        joinedAt: params.joinedAt,
        refDate: refForEntitlement,
        casualUsed,
      });
      if (needDays > rem) return false;
    }
  }
  return true;
}

export async function paidLeaveApproverBalancePreview(params: {
  userId: string;
  type: string;
  startDate: Date;
  endDate: Date;
}): Promise<{
  ledgerKind: PaidLeaveLedger | null;
  defaultDebitDays: number | null;
  sufficientForFullDefaultDebit: boolean;
}> {
  const ledgerKind = paidLeaveLedgerForType(params.type);
  if (!ledgerKind) {
    return {
      ledgerKind: null,
      defaultDebitDays: null,
      sufficientForFullDefaultDebit: true,
    };
  }

  const emp = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { probationEndsAt: true, joinedAt: true },
  });
  if (!emp) {
    return { ledgerKind, defaultDebitDays: null, sufficientForFullDefaultDebit: false };
  }

  const computed = workingDaysByHalfYear(params.startDate, params.endDate);
  const debitMap = ledgerDebitSplitByHalf(computed, undefined);
  const defaultDebitDays = [...debitMap.values()].reduce((a, b) => a + b, 0);

  const sufficientForFullDefaultDebit = await leaveDebitFitsBalances({
    userId: params.userId,
    probationEndsAt: emp.probationEndsAt,
    joinedAt: emp.joinedAt,
    ledger: ledgerKind,
    startDate: params.startDate,
    endDate: params.endDate,
    debitByHalf: debitMap,
  });

  return { ledgerKind, defaultDebitDays, sufficientForFullDefaultDebit };
}

export async function submitRequestPaidLeaveDebitFitsBalance(params: {
  userId: string;
  type: string;
  startDate: Date;
  endDate: Date;
}): Promise<boolean> {
  const ledger = paidLeaveLedgerForType(params.type);
  if (!ledger) return true;

  const emp = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { probationEndsAt: true, joinedAt: true },
  });
  if (!emp) return false;

  const computed = workingDaysByHalfYear(params.startDate, params.endDate);
  const debitMap = ledgerDebitSplitByHalf(computed, undefined);

  return leaveDebitFitsBalances({
    userId: params.userId,
    probationEndsAt: emp.probationEndsAt,
    joinedAt: emp.joinedAt,
    ledger,
    startDate: params.startDate,
    endDate: params.endDate,
    debitByHalf: debitMap,
  });
}
