"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Papa from "papaparse";

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getMe() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");
  return user;
}

function requireSalesHead(role: string) {
  if (!["MANAGER", "DEPT_HEAD", "CEO", "ADMIN", "HR"].includes(role)) {
    throw new Error("Only Sales Head / Admin can perform this action.");
  }
}

/** Find applicable slab rate for a given revenue amount. */
async function resolveSlabRate(revenue: number) {
  const slabs = await prisma.incentiveSlab.findMany({ orderBy: { order: "asc" } });
  let rate = 0;
  let label = "—";
  for (const s of slabs) {
    if (revenue >= s.minRev && (s.maxRev === null || revenue <= s.maxRev)) {
      rate = s.rate;
      label = s.label;
    }
  }
  return { rate, label };
}

/** Upsert an IncentiveSheet from a revenue figure (used when Sales Head sets/edits revenue). */
async function upsertSheetFromRevenue(
  userId: string,
  year: number,
  month: number,
  revenue: number,
  opts: { monthlyTarget?: number; adjustment?: number; adjustmentNote?: string } = {},
) {
  const existing = await prisma.incentiveSheet.findUnique({
    where: { userId_year_month: { userId, year, month } },
  });
  if (existing && existing.status !== "DRAFT") return existing; // locked — don't overwrite

  const { rate }        = await resolveSlabRate(revenue);
  const incentiveAmount = Math.round((revenue * rate) / 100);
  const manualAdj       = opts.adjustment ?? existing?.manualAdjustment ?? 0;
  const finalAmount     = incentiveAmount + manualAdj;

  return prisma.incentiveSheet.upsert({
    where:  { userId_year_month: { userId, year, month } },
    create: {
      userId, year, month,
      grossRevenue: revenue, adjustedRevenue: revenue,
      slabRate: rate, incentiveAmount,
      manualAdjustment: manualAdj,
      adjustmentNote:   opts.adjustmentNote ?? null,
      finalAmount,
      monthlyTarget:    opts.monthlyTarget ?? 0,
    },
    update: {
      grossRevenue: revenue, adjustedRevenue: revenue,
      slabRate: rate, incentiveAmount, finalAmount,
      manualAdjustment: manualAdj,
      ...(opts.adjustmentNote !== undefined && { adjustmentNote: opts.adjustmentNote }),
      ...(opts.monthlyTarget  !== undefined && { monthlyTarget:  opts.monthlyTarget  }),
    },
  });
}

// ─── period (month-level) ─────────────────────────────────────────────────────

export async function setPeriodSheetUrl(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const year  = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const sheetUrl = (formData.get("sheetUrl") as string)?.trim() || null;
  const note     = (formData.get("note") as string)?.trim() || null;

  await prisma.incentivePeriod.upsert({
    where: { year_month: { year, month } },
    create: { year, month, sheetUrl, note },
    update: { sheetUrl, note },
  });

  revalidatePath("/incentives");
}

// ─── revenue entry (Sales Head sets revenue per counsellor) ───────────────────

const revenueSchema = z.object({
  userId:   z.string(),
  year:     z.coerce.number().int(),
  month:    z.coerce.number().int().min(1).max(12),
  revenue:  z.coerce.number().int().nonnegative(),
});

export async function setRevenue(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const parsed = revenueSchema.parse({
    userId:  formData.get("userId"),
    year:    formData.get("year"),
    month:   formData.get("month"),
    revenue: formData.get("revenue"),
  });

  await upsertSheetFromRevenue(parsed.userId, parsed.year, parsed.month, parsed.revenue);
  revalidatePath("/incentives");
}

// ─── lock / approve / paid ────────────────────────────────────────────────────

const lockSchema = z.object({
  sheetId:          z.string(),
  manualAdjustment: z.coerce.number().int().default(0),
  adjustmentNote:   z.string().max(500).optional(),
});

export async function lockSheet(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const parsed = lockSchema.parse({
    sheetId:          formData.get("sheetId"),
    manualAdjustment: formData.get("manualAdjustment") || 0,
    adjustmentNote:   formData.get("adjustmentNote") || undefined,
  });

  const sheet = await prisma.incentiveSheet.findUnique({ where: { id: parsed.sheetId } });
  if (!sheet || sheet.status !== "DRAFT") throw new Error("Sheet not found or not in DRAFT.");

  const finalAmount = sheet.incentiveAmount + parsed.manualAdjustment;

  await prisma.incentiveSheet.update({
    where: { id: parsed.sheetId },
    data: {
      status: "LOCKED",
      manualAdjustment: parsed.manualAdjustment,
      adjustmentNote: parsed.adjustmentNote,
      finalAmount,
      lockedById: me.id,
      lockedAt: new Date(),
    },
  });

  revalidatePath("/incentives");
}

export async function approveSheet(sheetId: string) {
  const me = await getMe();
  if (!["ADMIN", "HR", "CEO"].includes(me.role)) throw new Error("Only Accounts Manager / Admin can approve.");

  const sheet = await prisma.incentiveSheet.findUnique({ where: { id: sheetId } });
  if (!sheet || sheet.status !== "LOCKED") throw new Error("Sheet not found or not locked.");

  await prisma.incentiveSheet.update({
    where: { id: sheetId },
    data: { status: "APPROVED", approvedById: me.id, approvedAt: new Date() },
  });

  revalidatePath("/incentives");
}

export async function markPaid(sheetId: string) {
  const me = await getMe();
  if (!["ADMIN", "HR", "CEO"].includes(me.role)) throw new Error("Only Accounts Manager / Admin can mark paid.");

  const sheet = await prisma.incentiveSheet.findUnique({ where: { id: sheetId } });
  if (!sheet || sheet.status !== "APPROVED") throw new Error("Sheet not approved yet.");

  await prisma.incentiveSheet.update({
    where: { id: sheetId },
    data: { status: "PAID", paidAt: new Date() },
  });

  revalidatePath("/incentives");
}

export async function markPaidAction(formData: FormData) {
  const sheetId = formData.get("sheetId") as string;
  return markPaid(sheetId);
}

// ─── delete / unlock individual sheet ─────────────────────────────────────────

export async function deleteSheet(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const sheetId = formData.get("sheetId") as string;
  if (!sheetId) throw new Error("Missing sheetId.");

  await prisma.incentiveSheet.delete({ where: { id: sheetId } });
  revalidatePath("/incentives");
}

export async function unlockSheet(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const sheetId = formData.get("sheetId") as string;
  if (!sheetId) throw new Error("Missing sheetId.");

  const sheet = await prisma.incentiveSheet.findUnique({ where: { id: sheetId } });
  if (!sheet) throw new Error("Sheet not found.");
  if (sheet.status === "APPROVED" || sheet.status === "PAID") {
    throw new Error("Cannot unlock an approved or paid sheet.");
  }

  await prisma.incentiveSheet.update({
    where: { id: sheetId },
    data: {
      status: "DRAFT",
      lockedById: null,
      lockedAt: null,
      finalAmount: sheet.incentiveAmount,
    },
  });

  revalidatePath("/incentives");
}

// ─── eligibility options (admin-configurable) ────────────────────────────────

export async function setEligibility(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const sheetId           = formData.get("sheetId") as string;
  const eligibilityOptionId = (formData.get("eligibilityOptionId") as string) || null;

  await prisma.incentiveSheet.update({
    where: { id: sheetId },
    data:  { eligibilityOptionId },
  });
  revalidatePath("/incentives");
}

export async function upsertEligibilityOption(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const id    = (formData.get("id") as string | null) || undefined;
  const label = ((formData.get("label") as string) ?? "").trim();
  const color = (formData.get("color") as string) || "gray";
  const order = Number(formData.get("order")) || 0;

  if (!label) throw new Error("Label is required.");

  if (id) {
    await prisma.incentiveEligibilityOption.update({ where: { id }, data: { label, color, order } });
  } else {
    await prisma.incentiveEligibilityOption.create({ data: { label, color, order } });
  }
  revalidatePath("/incentives");
}

export async function deleteEligibilityOption(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const id = formData.get("id") as string;
  await prisma.incentiveSheet.updateMany({ where: { eligibilityOptionId: id }, data: { eligibilityOptionId: null } });
  await prisma.incentiveEligibilityOption.delete({ where: { id } });
  revalidatePath("/incentives");
}

// ─── save targets per counsellor (without locking) ───────────────────────────

export async function saveTargets(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const year    = Number(formData.get("year"));
  const month   = Number(formData.get("month"));
  const userIds = formData.getAll("userId") as string[];
  const targets = formData.getAll("target") as string[];

  await Promise.all(
    userIds.map((userId, i) => {
      const target = Number(targets[i]) || 0;
      return prisma.incentiveSheet.upsert({
        where: { userId_year_month: { userId, year, month } },
        create: {
          userId, year, month,
          grossRevenue: 0, adjustedRevenue: 0, slabRate: 0,
          incentiveAmount: 0, manualAdjustment: 0, finalAmount: 0,
          monthlyTarget: target,
        },
        update: { monthlyTarget: target },
      });
    }),
  );

  revalidatePath("/incentives");
}

// ─── lock month in bulk (saves revenues + targets + notes, then locks all drafts) ─

type LockBulkState = { error?: string; success?: boolean };

export async function lockMonthBulk(
  _prev: LockBulkState,
  formData: FormData,
): Promise<LockBulkState> {
  const me = await getMe();
  try {
    requireSalesHead(me.role);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const year    = Number(formData.get("year"));
  const month   = Number(formData.get("month"));
  const userIds = formData.getAll("userId") as string[];
  const revenues = formData.getAll("revenue") as string[];
  const notes    = formData.getAll("note") as string[];
  const targets  = formData.getAll("target") as string[];

  if (!userIds.length) return { error: "No counsellor data to save." };

  // Upsert all revenues
  await Promise.all(
    userIds.map((userId, i) => {
      const revenue = Number(revenues[i]) || 0;
      return upsertSheetFromRevenue(userId, year, month, revenue);
    }),
  );

  // Save targets and notes to DRAFT sheets
  await Promise.all(
    userIds.map(async (userId, i) => {
      const note   = (notes[i]   ?? "").trim() || undefined;
      const target = Number(targets[i]) || 0;
      const data: Record<string, unknown> = {};
      if (note)       data.adjustmentNote = note;
      if (target > 0) data.monthlyTarget  = target;
      if (Object.keys(data).length === 0) return;
      await prisma.incentiveSheet.updateMany({
        where: { userId, year, month, status: "DRAFT" },
        data,
      });
    }),
  );

  // Lock all remaining DRAFT sheets
  const draftSheets = await prisma.incentiveSheet.findMany({
    where: { year, month, status: "DRAFT" },
  });

  if (draftSheets.length > 0) {
    const now = new Date();
    await Promise.all(
      draftSheets.map((s) =>
        prisma.incentiveSheet.update({
          where: { id: s.id },
          data: {
            status: "LOCKED",
            finalAmount: s.incentiveAmount + (s.manualAdjustment ?? 0),
            lockedById: me.id,
            lockedAt: now,
          },
        }),
      ),
    );
  }

  revalidatePath("/incentives");
  return { success: true };
}

// ─── bulk send to accounts (locks all DRAFT sheets for a month at once) ──────

export async function sendMonthToAccounts(formData: FormData) {
  const me = await getMe();
  requireSalesHead(me.role);

  const year  = Number(formData.get("year"));
  const month = Number(formData.get("month"));

  const draftSheets = await prisma.incentiveSheet.findMany({
    where: { year, month, status: "DRAFT" },
  });

  if (draftSheets.length === 0) throw new Error("No draft sheets to lock for this month.");

  // Lock each sheet individually so finalAmount (= incentiveAmount + adjustment) is set correctly
  const now = new Date();
  await Promise.all(
    draftSheets.map((s) =>
      prisma.incentiveSheet.update({
        where: { id: s.id },
        data: {
          status: "LOCKED",
          finalAmount: s.incentiveAmount + (s.manualAdjustment ?? 0),
          lockedById: me.id,
          lockedAt: now,
        },
      }),
    ),
  );

  revalidatePath("/incentives");
}

// ─── bulk import (Sales Head: CSV with email + revenue) ───────────────────────

export type BulkImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

const bulkRowSchema = z.object({
  counsellor_email: z.string().email("counsellor_email must be a valid email"),
  revenue:          z.coerce.number().int().nonnegative("revenue must be a non-negative integer"),
  monthly_target:   z.coerce.number().int().nonnegative().optional().default(0),
  adjustment:       z.coerce.number().int().optional().default(0),
  adjustment_note:  z.string().optional().default(""),
  // team and cluster are informational only — silently ignored
  team:    z.string().optional(),
  cluster: z.string().optional(),
});

export async function bulkImportRevenue(
  _prev: BulkImportResult,
  formData: FormData,
): Promise<BulkImportResult> {
  const me = await getMe();
  if (!["MANAGER", "DEPT_HEAD", "CEO", "ADMIN", "HR"].includes(me.role)) {
    return { imported: 0, skipped: 0, errors: ["Only Sales Head / Admin can import revenue."] };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { imported: 0, skipped: 0, errors: ["No file uploaded."] };

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  if (parsed.errors.length > 0) {
    return { imported: 0, skipped: 0, errors: [`CSV parse error: ${parsed.errors[0].message}`] };
  }

  // Determine month/year from form (default = current month)
  const now = new Date();
  const year  = Number(formData.get("year")  || now.getFullYear());
  const month = Number(formData.get("month") || (now.getMonth() + 1));

  const userCache = new Map<string, string>();
  async function resolveUserId(email: string) {
    if (userCache.has(email)) return userCache.get(email)!;
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) userCache.set(email, u.id);
    return u?.id ?? null;
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const rowNum = i + 2;
    const row = bulkRowSchema.safeParse(parsed.data[i]);
    if (!row.success) {
      errors.push(`Row ${rowNum}: ${row.error.issues.map((e: { message: string }) => e.message).join(", ")}`);
      skipped++;
      continue;
    }

    const userId = await resolveUserId(row.data.counsellor_email);
    if (!userId) {
      errors.push(`Row ${rowNum}: No user found for "${row.data.counsellor_email}".`);
      skipped++;
      continue;
    }

    const existing = await prisma.incentiveSheet.findUnique({
      where: { userId_year_month: { userId, year, month } },
    });
    if (existing && existing.status !== "DRAFT") {
      errors.push(`Row ${rowNum}: Sheet for ${row.data.counsellor_email} is already locked.`);
      skipped++;
      continue;
    }

    await upsertSheetFromRevenue(userId, year, month, row.data.revenue, {
      monthlyTarget:  row.data.monthly_target,
      adjustment:     row.data.adjustment,
      adjustmentNote: row.data.adjustment_note || undefined,
    });
    imported++;
  }

  revalidatePath("/incentives");
  return { imported, skipped, errors };
}

// ─── Google Sheets sync ───────────────────────────────────────────────────────

/**
 * Pull revenue data from the Google Sheet stored in IncentivePeriod.sheetUrl
 * for the given month and upsert IncentiveSheet records.
 *
 * Can be called as a server action (from the UI) or directly (from the cron).
 * Returns the same BulkImportResult shape as bulkImportRevenue.
 */
export async function syncRevenueFromSheet(
  year: number,
  month: number,
): Promise<BulkImportResult> {
  const me = await getMe();
  requireSalesHead(me.role);

  const period = await prisma.incentivePeriod.findUnique({
    where: { year_month: { year, month } },
    select: { sheetUrl: true },
  });

  if (!period?.sheetUrl) {
    return {
      imported: 0,
      skipped:  0,
      errors:   ["No Google Sheet URL is set for this month. Add one in the Month-End Review tab."],
    };
  }

  let rows: Record<string, string>[];
  try {
    const { fetchSheetRows } = await import("@/lib/google-sheets");
    rows = await fetchSheetRows(period.sheetUrl);
  } catch (err) {
    return { imported: 0, skipped: 0, errors: [`Failed to read sheet: ${String(err)}`] };
  }

  if (rows.length === 0) {
    return { imported: 0, skipped: 0, errors: ["Sheet is empty or has no data rows."] };
  }

  const userCache = new Map<string, string>();
  async function resolveUserId(email: string) {
    if (userCache.has(email)) return userCache.get(email)!;
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) userCache.set(email, u.id);
    return u?.id ?? null;
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped  = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = bulkRowSchema.safeParse(rows[i]);
    if (!row.success) {
      errors.push(`Row ${rowNum}: ${row.error.issues.map((e) => e.message).join(", ")}`);
      skipped++;
      continue;
    }

    const userId = await resolveUserId(row.data.counsellor_email);
    if (!userId) {
      errors.push(`Row ${rowNum}: No user found for "${row.data.counsellor_email}".`);
      skipped++;
      continue;
    }

    const existing = await prisma.incentiveSheet.findUnique({
      where: { userId_year_month: { userId, year, month } },
    });
    if (existing && existing.status !== "DRAFT") {
      errors.push(`Row ${rowNum}: Sheet for ${row.data.counsellor_email} is already locked.`);
      skipped++;
      continue;
    }

    await upsertSheetFromRevenue(userId, year, month, row.data.revenue, {
      monthlyTarget:  row.data.monthly_target,
      adjustment:     row.data.adjustment,
      adjustmentNote: row.data.adjustment_note || undefined,
    });
    imported++;
  }

  revalidatePath("/incentives");
  return { imported, skipped, errors };
}

/**
 * FormData wrapper so syncRevenueFromSheet can be used directly as a form action.
 */
export async function syncRevenueFromSheetAction(formData: FormData): Promise<BulkImportResult> {
  const year  = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  return syncRevenueFromSheet(year, month);
}
