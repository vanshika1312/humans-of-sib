import { prisma } from "@/lib/prisma";
import { ledgerDebitSplitByHalf } from "@/lib/leave-debit-allocation";
import {
  casualRemaining,
  parseHalfKey,
  sickRemaining,
  workingDaysByHalfYearForLeave,
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

function leaveDebitFitsBalancesSync(params: {
  userId: string;
  probationEndsAt: Date | null;
  joinedAt: Date;
  ledger: PaidLeaveLedger;
  startDate: Date;
  endDate: Date;
  debitByHalf: Map<string, number>;
  getBalance: (periodYear: number, half: number) => { casualUsed: number; sickUsed: number };
}): boolean {
  for (const [key, needDays] of params.debitByHalf.entries()) {
    if (needDays <= 0) continue;
    const { periodYear, half } = parseHalfKey(key);
    const { casualUsed, sickUsed } = params.getBalance(periodYear, half);

    const daysInHalf = workingDaysInHalf(params.startDate, params.endDate, periodYear, half);
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

export async function leaveDebitFitsBalances(params: {
  userId: string;
  probationEndsAt: Date | null;
  joinedAt: Date;
  ledger: PaidLeaveLedger;
  startDate: Date;
  endDate: Date;
  debitByHalf: Map<string, number>;
}): Promise<boolean> {
  const results = await Promise.all(
    [...params.debitByHalf.entries()].map(async ([key, needDays]) => {
      if (needDays <= 0) return true;
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
        return needDays <= rem;
      }
      const rem = casualRemaining({
        probationEndsAt: params.probationEndsAt,
        joinedAt: params.joinedAt,
        refDate: refForEntitlement,
        casualUsed,
      });
      return needDays <= rem;
    }),
  );
  return results.every(Boolean);
}

export type PaidLeaveBalancePrefetch = {
  usersById: Map<string, { probationEndsAt: Date | null; joinedAt: Date }>;
  getBalance: (userId: string, periodYear: number, half: number) => { casualUsed: number; sickUsed: number };
};

function prefetchBalanceCompositeKey(userId: string, periodYear: number, half: number) {
  return `${userId}:${periodYear}:${half}`;
}

/** Load users + leave-balance rows needed for many {@link paidLeaveApproverBalancePreviewCached} calls in one round-trip. */
export async function prefetchPaidLeaveBalancePreviewContext(
  items: ReadonlyArray<{
    userId: string;
    type: string;
    startDate: Date;
    endDate: Date;
    isHalfDay?: boolean;
  }>,
): Promise<PaidLeaveBalancePrefetch> {
  const emptyBalance = () => ({ casualUsed: 0, sickUsed: 0 });

  if (items.length === 0) {
    return {
      usersById: new Map(),
      getBalance: () => emptyBalance(),
    };
  }

  const userIds = [...new Set(items.map((i) => i.userId))];
  const tupleKeys = new Map<
    string,
    { userId: string; periodYear: number; half: number }
  >();

  for (const item of items) {
    const ledgerKind = paidLeaveLedgerForType(item.type);
    if (!ledgerKind) continue;
    const computed = workingDaysByHalfYearForLeave(
      item.startDate,
      item.endDate,
      item.isHalfDay ?? false,
    );
    const debitMap = ledgerDebitSplitByHalf(computed, undefined);
    for (const key of debitMap.keys()) {
      const { periodYear, half } = parseHalfKey(key);
      const ck = prefetchBalanceCompositeKey(item.userId, periodYear, half);
      tupleKeys.set(ck, { userId: item.userId, periodYear, half });
    }
  }

  const [users, balances] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, probationEndsAt: true, joinedAt: true },
    }),
    tupleKeys.size === 0
      ? Promise.resolve([])
      : prisma.leaveBalance.findMany({
          where: {
            OR: [...tupleKeys.values()].map((t) => ({
              userId: t.userId,
              periodYear: t.periodYear,
              half: t.half,
            })),
          },
          select: { userId: true, periodYear: true, half: true, casualUsed: true, sickUsed: true },
        }),
  ]);

  const usersById = new Map(users.map((u) => [u.id, u]));
  const balanceMap = new Map<string, { casualUsed: number; sickUsed: number }>();
  for (const b of balances) {
    balanceMap.set(prefetchBalanceCompositeKey(b.userId, b.periodYear, b.half), {
      casualUsed: b.casualUsed,
      sickUsed: b.sickUsed,
    });
  }

  return {
    usersById,
    getBalance: (userId, periodYear, half) =>
      balanceMap.get(prefetchBalanceCompositeKey(userId, periodYear, half)) ?? emptyBalance(),
  };
}

/** Same semantics as {@link paidLeaveApproverBalancePreview} using prefetch data (no per-row DB reads). */
export function paidLeaveApproverBalancePreviewCached(
  params: {
    userId: string;
    type: string;
    startDate: Date;
    endDate: Date;
    isHalfDay?: boolean;
  },
  prefetch: PaidLeaveBalancePrefetch,
): {
  ledgerKind: PaidLeaveLedger | null;
  defaultDebitDays: number | null;
  sufficientForFullDefaultDebit: boolean;
} {
  const ledgerKind = paidLeaveLedgerForType(params.type);
  if (!ledgerKind) {
    return {
      ledgerKind: null,
      defaultDebitDays: null,
      sufficientForFullDefaultDebit: true,
    };
  }

  const emp = prefetch.usersById.get(params.userId);
  if (!emp) {
    return { ledgerKind, defaultDebitDays: null, sufficientForFullDefaultDebit: false };
  }

  const computed = workingDaysByHalfYearForLeave(
    params.startDate,
    params.endDate,
    params.isHalfDay ?? false,
  );
  const debitMap = ledgerDebitSplitByHalf(computed, undefined);
  const defaultDebitDays = [...debitMap.values()].reduce((a, b) => a + b, 0);

  const sufficientForFullDefaultDebit = leaveDebitFitsBalancesSync({
    userId: params.userId,
    probationEndsAt: emp.probationEndsAt,
    joinedAt: emp.joinedAt,
    ledger: ledgerKind,
    startDate: params.startDate,
    endDate: params.endDate,
    debitByHalf: debitMap,
    getBalance: (periodYear, half) => prefetch.getBalance(params.userId, periodYear, half),
  });

  return { ledgerKind, defaultDebitDays, sufficientForFullDefaultDebit };
}

export async function paidLeaveApproverBalancePreview(params: {
  userId: string;
  type: string;
  startDate: Date;
  endDate: Date;
  isHalfDay?: boolean;
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

  const computed = workingDaysByHalfYearForLeave(params.startDate, params.endDate, params.isHalfDay ?? false);
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
  isHalfDay?: boolean;
}): Promise<boolean> {
  const ledger = paidLeaveLedgerForType(params.type);
  if (!ledger) return true;

  const emp = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { probationEndsAt: true, joinedAt: true },
  });
  if (!emp) return false;

  const computed = workingDaysByHalfYearForLeave(params.startDate, params.endDate, params.isHalfDay ?? false);
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
