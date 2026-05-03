"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calendarDateFromInput } from "@/lib/calendar-date";
import { canApproveForEmployee, type AttendanceApproverContext } from "@/lib/attendance-scope";
import type { LeaveType, Prisma } from "@/generated/prisma";
import { getHalfYearPeriod, parseHalfKey, workingDaysByHalfYear } from "@/lib/leave-policy";
import { revalidatePath } from "next/cache";
import {
  canApproveSickLeaveWithMedicalRule,
  sickLeaveMedicalProofProvided,
  sickLeaveMedicalProofRequired,
} from "@/lib/sick-leave-medical-proof";
import { ledgerDebitSplitByHalf } from "@/lib/leave-debit-allocation";
import {
  leaveDebitFitsBalances,
  leaveRequestsAllowInsufficientPaidBalance,
  paidLeaveLedgerForType,
  submitRequestPaidLeaveDebitFitsBalance,
} from "@/lib/leave-balance-guard";
import { redirect } from "next/navigation";

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function stripTime(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function combineDateAndTime(dateYmd: string, timeHHMM: string | null): Date | null {
  if (!timeHHMM?.trim()) return null;
  const [y, m, da] = dateYmd.split("-").map(Number);
  const [h, mi] = timeHHMM.split(":").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(h)) return null;
  return new Date(y, m - 1, da, h, mi, 0, 0);
}

function parseDateOnly(s: string): Date {
  const [y, m, da] = s.split("-").map(Number);
  return new Date(y, m - 1, da, 0, 0, 0, 0);
}

async function loadApproverContext(email: string): Promise<(AttendanceApproverContext & { email: string }) | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, headedDept: { select: { id: true } } },
  });
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    headedDeptId: user.headedDept?.id ?? null,
    email,
  };
}

async function upsertLeaveBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  periodYear: number,
  half: number,
) {
  await tx.leaveBalance.upsert({
    where: { userId_periodYear_half: { userId, periodYear, half } },
    create: { userId, periodYear, half },
    update: {},
  });
}

export async function ensureLeaveBalanceRow(userId: string, refDate: Date = new Date()) {
  const { periodYear, half } = getHalfYearPeriod(refDate);
  await prisma.leaveBalance.upsert({
    where: { userId_periodYear_half: { userId, periodYear, half } },
    create: { userId, periodYear, half },
    update: {},
  });
}

export async function checkIn(mode: "OFFICE" | "WFH" | "FIELD", note?: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  await prisma.attendance.upsert({
    where: { userId_date: { userId: user.id, date: today() } },
    update: { checkIn: new Date(), mode, note: note || undefined, source: "MANUAL" },
    create: {
      userId: user.id,
      date: today(),
      checkIn: new Date(),
      mode,
      note: note || undefined,
      source: "MANUAL",
    },
  });

  revalidatePath("/attendance");
  revalidatePath("/home");
}

export async function checkOut() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  await prisma.attendance.update({
    where: { userId_date: { userId: user.id, date: today() } },
    data: { checkOut: new Date(), source: "MANUAL" },
  });
  revalidatePath("/attendance");
  revalidatePath("/home");
}

export async function submitCheckInForm(formData: FormData) {
  const mode = (formData.get("mode") || "OFFICE") as "OFFICE" | "WFH" | "FIELD";
  const note = String(formData.get("note") || "").trim() || undefined;
  await checkIn(mode, note);
}

export async function submitCheckOut() {
  await checkOut();
}

/** --- Regularisation -------------------------------------------------------- */

export async function submitRegularisationForm(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const dateRaw = String(formData.get("regDate") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const mode = String(formData.get("regMode") || "OFFICE") as "OFFICE" | "WFH" | "FIELD";
  const checkInT = String(formData.get("regCheckIn") || "").trim() || null;
  const checkOutT = String(formData.get("regCheckOut") || "").trim() || null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return;
  if (reason.length < 4) return;

  const rowDate = parseDateOnly(dateRaw);
  if (rowDate > today()) return;

  const requestCheckIn = combineDateAndTime(dateRaw, checkInT);
  const requestCheckOut = combineDateAndTime(dateRaw, checkOutT);
  if (!requestCheckIn) return;

  await prisma.regularisationRequest.create({
    data: {
      userId: user.id,
      date: rowDate,
      reason,
      requestCheckIn,
      requestCheckOut,
      requestMode: mode,
    },
  });
  revalidatePath("/attendance");
}

export async function reviewRegularisationForm(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const viewer = await loadApproverContext(session.user.email);
  if (!viewer) throw new Error("Unauthorized");

  const id = String(formData.get("requestId") || "");
  const action = String(formData.get("reviewAction") || "");
  const reviewNote = String(formData.get("reviewNote") || "").trim() || undefined;
  if (!id || !["approve", "reject"].includes(action)) return;

  const req = await prisma.regularisationRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, managerId: true, departmentId: true } },
    },
  });
  if (!req || req.status !== "PENDING") return;

  if (!canApproveForEmployee(viewer, req.user)) return;

  if (action === "reject") {
    await prisma.regularisationRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: viewer.id,
        reviewedAt: new Date(),
        reviewNote,
      },
    });
    revalidatePath("/attendance");
    return;
  }

  const d = stripTime(req.date);
  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: req.userId, date: d } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.regularisationRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: viewer.id,
        reviewedAt: new Date(),
        reviewNote,
      },
    });

    await tx.attendance.upsert({
      where: { userId_date: { userId: req.userId, date: d } },
      create: {
        userId: req.userId,
        date: d,
        checkIn: req.requestCheckIn,
        checkOut: req.requestCheckOut ?? req.requestCheckIn,
        mode: req.requestMode ?? "OFFICE",
        source: "REGULARISED",
        note: existing?.note ?? `Regularisation approved · ${req.reason.slice(0, 160)}`,
      },
      update: {
        checkIn: req.requestCheckIn ?? undefined,
        checkOut: req.requestCheckOut ?? existing?.checkOut ?? req.requestCheckIn ?? undefined,
        mode: req.requestMode ?? undefined,
        source: "REGULARISED",
      },
    });
  });

  revalidatePath("/attendance");
}

/** --- Leave --------------------------------------------------------------- */

export async function submitLeaveRequestForm(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, managerId: true },
  });
  if (!user) throw new Error("User not found");

  const type = String(formData.get("leaveType") || "CASUAL");
  const start = String(formData.get("leaveStart") || "").trim();
  const end = String(formData.get("leaveEnd") || "").trim();
  const reason = String(formData.get("leaveReason") || "").trim() || undefined;
  const medicalProofUrl = String(formData.get("medicalProofUrl") || "").trim() || undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return;
  const sd = calendarDateFromInput(start);
  const ed = calendarDateFromInput(end);
  if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime()) || ed.getTime() < sd.getTime()) return;

  const needMedical =
    type === "SICK" ? await sickLeaveMedicalProofRequired(user.id, sd, ed) : false;
  if (needMedical && !sickLeaveMedicalProofProvided(type, medicalProofUrl)) {
    redirect("/attendance?leaveApplyError=medical_proof");
  }

  if (!leaveRequestsAllowInsufficientPaidBalance()) {
    const okBal = await submitRequestPaidLeaveDebitFitsBalance({
      userId: user.id,
      type,
      startDate: sd,
      endDate: ed,
    });
    if (!okBal) {
      redirect("/attendance?leaveApplyError=insufficient_balance");
    }
  }

  await prisma.leaveRequest.create({
    data: {
      userId: user.id,
      approverId: user.managerId,
      type: type as LeaveType,
      startDate: sd,
      endDate: ed,
      reason,
      medicalProofUrl: medicalProofUrl || null,
      status: "PENDING",
    },
  });
  revalidatePath("/attendance");
}

export async function attachSickLeaveMedicalProofForm(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");

  const leaveId = String(formData.get("leaveId") || "").trim();
  const medicalProofUrl = String(formData.get("medicalProofUrl") || "").trim();
  if (!leaveId || !medicalProofUrl) return;

  const lr = await prisma.leaveRequest.findFirst({
    where: { id: leaveId, userId: user.id, type: "SICK", status: "PENDING" },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!lr) return;

  const need = await sickLeaveMedicalProofRequired(user.id, lr.startDate, lr.endDate);
  if (!need) return;

  await prisma.leaveRequest.update({
    where: { id: lr.id },
    data: { medicalProofUrl },
  });
  revalidatePath("/attendance");
}

export async function reviewLeaveForm(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const viewer = await loadApproverContext(session.user.email);
  if (!viewer) throw new Error("Unauthorized");

  const id = String(formData.get("leaveId") || "");
  const action = String(formData.get("leaveReviewAction") || "");
  const responseNote = String(formData.get("leaveReviewNote") || "").trim() || undefined;
  if (!id || !["approve", "reject"].includes(action)) return;

  const lr = await prisma.leaveRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, managerId: true, departmentId: true } },
    },
  });
  if (!lr || lr.status !== "PENDING") return;
  if (!canApproveForEmployee(viewer, lr.user)) return;

  const ledger = paidLeaveLedgerForType(lr.type);

  const debitOverrideRaw = String(formData.get("leaveBalanceDebitOverride") ?? "").trim();
  /** Proportional split across half-years — null skip path for unpaid rejects. */
  let debitSplitForApprove: Map<string, number> | null = null;
  let appliedLedgerDebitDaysTotal: number | null = null;

  let debitOverrideRequested: number | undefined;
  if (debitOverrideRaw !== "") {
    const n = Number.parseInt(debitOverrideRaw, 10);
    if (Number.isFinite(n) && n >= 0) debitOverrideRequested = n;
  }

  if (action === "approve") {
    const medicalOk = await canApproveSickLeaveWithMedicalRule({
      userId: lr.userId,
      startDate: lr.startDate,
      endDate: lr.endDate,
      type: lr.type,
      medicalProofUrl: lr.medicalProofUrl,
    });
    if (!medicalOk) {
      redirect("/attendance?leaveApprovalError=medical_proof");
    }
  }

  if (action === "approve" && ledger) {
    const computed = workingDaysByHalfYear(lr.startDate, lr.endDate);
    debitSplitForApprove = ledgerDebitSplitByHalf(computed, debitOverrideRequested);
    appliedLedgerDebitDaysTotal = [...debitSplitForApprove.values()].reduce((a, b) => a + b, 0);

    const emp = await prisma.user.findUnique({
      where: { id: lr.userId },
      select: { probationEndsAt: true, joinedAt: true },
    });
    if (!emp) return;

    const ok = await leaveDebitFitsBalances({
      userId: lr.userId,
      probationEndsAt: emp.probationEndsAt,
      joinedAt: emp.joinedAt,
      ledger,
      startDate: lr.startDate,
      endDate: lr.endDate,
      debitByHalf: debitSplitForApprove,
    });
    if (!ok) {
      redirect("/attendance?leaveApprovalError=insufficient_balance");
    }
  }

  await prisma.$transaction(async (tx) => {
    if (action === "reject") {
      await tx.leaveRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          respondedAt: new Date(),
          responseNote,
          approverId: viewer.id,
        },
      });
      return;
    }

    if (ledger && debitSplitForApprove) {
      for (const [key, cnt] of debitSplitForApprove.entries()) {
        if (cnt <= 0) continue;
        const { periodYear, half } = parseHalfKey(key);
        await upsertLeaveBalance(tx, lr.userId, periodYear, half);
        await tx.leaveBalance.update({
          where: { userId_periodYear_half: { userId: lr.userId, periodYear, half } },
          data:
            ledger === "casualUsed"
              ? { casualUsed: { increment: cnt } }
              : { sickUsed: { increment: cnt } },
        });
      }
    }

    await tx.leaveRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        respondedAt: new Date(),
        responseNote,
        approverId: viewer.id,
        ...(appliedLedgerDebitDaysTotal !== null
          ? { appliedLedgerDebitDays: appliedLedgerDebitDaysTotal }
          : {}),
      },
    });
  });

  revalidatePath("/attendance");
}
