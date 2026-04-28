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

/** Find applicable slab for a given revenue amount (highest minRev ≤ revenue). */
async function resolveSlabRate(revenue: number): Promise<{ rate: number; label: string }> {
  const slabs = await prisma.incentiveSlab.findMany({ orderBy: { order: "asc" } });
  let match = { rate: 0, label: "—" };
  for (const s of slabs) {
    if (revenue >= s.minRev && (s.maxRev === null || revenue <= s.maxRev)) {
      match = { rate: s.rate, label: s.label };
    }
  }
  return match;
}

/** Upsert the IncentiveSheet for a counsellor/month, re-totalling from SaleEntry rows. */
async function syncSheet(userId: string, year: number, month: number) {
  const sales = await prisma.saleEntry.findMany({ where: { userId, year, month } });
  const gross = sales.filter((s) => s.status === "ACTIVE").reduce((acc, s) => acc + s.revenue, 0);
  const adjusted = gross; // refunded/cancelled entries are excluded by status filter

  const existing = await prisma.incentiveSheet.findUnique({
    where: { userId_year_month: { userId, year, month } },
  });

  // Only recalculate amounts when DRAFT (Sales Head may have locked already)
  if (existing && existing.status !== "DRAFT") return existing;

  const { rate } = await resolveSlabRate(adjusted);
  const incentiveAmount = Math.round((adjusted * rate) / 100);
  const finalAmount = incentiveAmount + (existing?.manualAdjustment ?? 0);

  return prisma.incentiveSheet.upsert({
    where: { userId_year_month: { userId, year, month } },
    create: {
      userId,
      year,
      month,
      grossRevenue: gross,
      adjustedRevenue: adjusted,
      slabRate: rate,
      incentiveAmount,
      manualAdjustment: 0,
      finalAmount,
    },
    update: {
      grossRevenue: gross,
      adjustedRevenue: adjusted,
      slabRate: rate,
      incentiveAmount,
      finalAmount,
    },
  });
}

// ─── counsellor actions ───────────────────────────────────────────────────────

const saleSchema = z.object({
  studentName: z.string().min(1).max(200),
  courseName: z.string().min(1).max(200),
  revenue: z.coerce.number().int().positive(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional(),
});

export async function addSale(formData: FormData) {
  const me = await getMe();

  const parsed = saleSchema.parse({
    studentName: formData.get("studentName"),
    courseName: formData.get("courseName"),
    revenue: formData.get("revenue"),
    saleDate: formData.get("saleDate"),
    note: formData.get("note") || undefined,
  });

  const date = new Date(parsed.saleDate);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  // Prevent adding sales to a locked sheet
  const sheet = await prisma.incentiveSheet.findUnique({
    where: { userId_year_month: { userId: me.id, year, month } },
  });
  if (sheet && sheet.status !== "DRAFT") throw new Error("This month's sheet is already locked.");

  const entry = await prisma.saleEntry.create({
    data: {
      userId: me.id,
      year,
      month,
      studentName: parsed.studentName,
      courseName: parsed.courseName,
      revenue: parsed.revenue,
      saleDate: date,
      note: parsed.note,
    },
  });

  const updatedSheet = await syncSheet(me.id, year, month);
  await prisma.saleEntry.update({ where: { id: entry.id }, data: { sheetId: updatedSheet.id } });

  revalidatePath("/incentives");
}

export async function deleteSale(id: string) {
  const me = await getMe();
  const sale = await prisma.saleEntry.findUnique({ where: { id } });
  if (!sale || sale.userId !== me.id) throw new Error("Not found");

  const sheet = await prisma.incentiveSheet.findUnique({
    where: { userId_year_month: { userId: me.id, year: sale.year, month: sale.month } },
  });
  if (sheet && sheet.status !== "DRAFT") throw new Error("Sheet is locked — cannot delete.");

  await prisma.saleEntry.delete({ where: { id } });
  await syncSheet(me.id, sale.year, sale.month);
  revalidatePath("/incentives");
}

export async function markSaleRefunded(id: string) {
  const me = await getMe();
  const sale = await prisma.saleEntry.findUnique({ where: { id } });
  if (!sale || sale.userId !== me.id) throw new Error("Not found");

  const sheet = await prisma.incentiveSheet.findUnique({
    where: { userId_year_month: { userId: me.id, year: sale.year, month: sale.month } },
  });
  if (sheet && sheet.status !== "DRAFT") throw new Error("Sheet is locked.");

  await prisma.saleEntry.update({ where: { id }, data: { status: "REFUNDED" } });
  await syncSheet(me.id, sale.year, sale.month);
  revalidatePath("/incentives");
}

// ─── sales head actions ───────────────────────────────────────────────────────

const lockSchema = z.object({
  sheetId: z.string(),
  manualAdjustment: z.coerce.number().int().default(0),
  adjustmentNote: z.string().max(500).optional(),
});

export async function lockSheet(formData: FormData) {
  const me = await getMe();
  if (!["MANAGER", "DEPT_HEAD", "CEO", "ADMIN", "HR"].includes(me.role)) {
    throw new Error("Only Sales Head / Admin can lock sheets.");
  }

  const parsed = lockSchema.parse({
    sheetId: formData.get("sheetId"),
    manualAdjustment: formData.get("manualAdjustment") || 0,
    adjustmentNote: formData.get("adjustmentNote") || undefined,
  });

  const sheet = await prisma.incentiveSheet.findUnique({ where: { id: parsed.sheetId } });
  if (!sheet || sheet.status !== "DRAFT") throw new Error("Sheet not found or not in DRAFT.");

  // Re-sync totals one last time before locking
  const synced = await syncSheet(sheet.userId, sheet.year, sheet.month);
  const finalAmount = synced.incentiveAmount + parsed.manualAdjustment;

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

// ─── accounts manager actions ─────────────────────────────────────────────────

export async function approveSheet(sheetId: string) {
  const me = await getMe();
  if (!["ADMIN", "HR", "CEO"].includes(me.role)) {
    throw new Error("Only Accounts Manager / Admin can approve.");
  }

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
  if (!["ADMIN", "HR", "CEO"].includes(me.role)) {
    throw new Error("Only Accounts Manager / Admin can mark paid.");
  }

  const sheet = await prisma.incentiveSheet.findUnique({ where: { id: sheetId } });
  if (!sheet || sheet.status !== "APPROVED") throw new Error("Sheet not approved yet.");

  await prisma.incentiveSheet.update({
    where: { id: sheetId },
    data: { status: "PAID", paidAt: new Date() },
  });

  revalidatePath("/incentives");
}

// ─── bulk import ──────────────────────────────────────────────────────────────

export type BulkImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

const csvRowSchema = z.object({
  student_name: z.string().min(1),
  course_name: z.string().min(1),
  revenue: z.coerce.number().int().positive(),
  sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "sale_date must be YYYY-MM-DD"),
  note: z.string().optional(),
});

async function parseCsvFile(file: File): Promise<{ rows: Record<string, string>[]; parseError?: string }> {
  const text = await file.text();
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  if (result.errors.length > 0) {
    return { rows: [], parseError: result.errors[0].message };
  }
  return { rows: result.data };
}

/** Counsellor imports their own sales from a CSV file. */
export async function bulkImportSales(_prev: BulkImportResult, formData: FormData): Promise<BulkImportResult> {
  const me = await getMe();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { imported: 0, skipped: 0, errors: ["No file uploaded."] };

  const { rows, parseError } = await parseCsvFile(file);
  if (parseError) return { imported: 0, skipped: 0, errors: [`CSV parse error: ${parseError}`] };

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // header = row 1
    const parsed = csvRowSchema.safeParse(rows[i]);
    if (!parsed.success) {
      errors.push(`Row ${rowNum}: ${parsed.error.errors.map((e) => e.message).join(", ")}`);
      skipped++;
      continue;
    }

    const date = new Date(parsed.data.sale_date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const sheet = await prisma.incentiveSheet.findUnique({
      where: { userId_year_month: { userId: me.id, year, month } },
    });
    if (sheet && sheet.status !== "DRAFT") {
      errors.push(`Row ${rowNum}: Sheet for ${date.toLocaleString("default", { month: "long", year: "numeric" })} is locked.`);
      skipped++;
      continue;
    }

    const entry = await prisma.saleEntry.create({
      data: {
        userId: me.id,
        year,
        month,
        studentName: parsed.data.student_name,
        courseName: parsed.data.course_name,
        revenue: parsed.data.revenue,
        saleDate: date,
        note: parsed.data.note,
      },
    });

    const updatedSheet = await syncSheet(me.id, year, month);
    await prisma.saleEntry.update({ where: { id: entry.id }, data: { sheetId: updatedSheet.id } });
    imported++;
  }

  revalidatePath("/incentives");
  return { imported, skipped, errors };
}

const csvRowWithEmailSchema = csvRowSchema.extend({
  counsellor_email: z.string().email("counsellor_email must be a valid email"),
});

/** Sales Head imports sales on behalf of team members. CSV must include counsellor_email column. */
export async function bulkImportForTeam(_prev: BulkImportResult, formData: FormData): Promise<BulkImportResult> {
  const me = await getMe();
  if (!["MANAGER", "DEPT_HEAD", "CEO", "ADMIN", "HR"].includes(me.role)) {
    return { imported: 0, skipped: 0, errors: ["Only Sales Head / Admin can import for the team."] };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { imported: 0, skipped: 0, errors: ["No file uploaded."] };

  const { rows, parseError } = await parseCsvFile(file);
  if (parseError) return { imported: 0, skipped: 0, errors: [`CSV parse error: ${parseError}`] };

  // Cache user lookups to avoid n+1
  const userCache = new Map<string, string>();
  async function resolveUserId(email: string): Promise<string | null> {
    if (userCache.has(email)) return userCache.get(email)!;
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) userCache.set(email, u.id);
    return u?.id ?? null;
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const parsed = csvRowWithEmailSchema.safeParse(rows[i]);
    if (!parsed.success) {
      errors.push(`Row ${rowNum}: ${parsed.error.errors.map((e) => e.message).join(", ")}`);
      skipped++;
      continue;
    }

    const userId = await resolveUserId(parsed.data.counsellor_email);
    if (!userId) {
      errors.push(`Row ${rowNum}: No user found for email "${parsed.data.counsellor_email}".`);
      skipped++;
      continue;
    }

    const date = new Date(parsed.data.sale_date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const sheet = await prisma.incentiveSheet.findUnique({
      where: { userId_year_month: { userId, year, month } },
    });
    if (sheet && sheet.status !== "DRAFT") {
      errors.push(`Row ${rowNum}: Sheet for ${parsed.data.counsellor_email} (${date.toLocaleString("default", { month: "long", year: "numeric" })}) is locked.`);
      skipped++;
      continue;
    }

    const entry = await prisma.saleEntry.create({
      data: { userId, year, month, studentName: parsed.data.student_name, courseName: parsed.data.course_name, revenue: parsed.data.revenue, saleDate: date, note: parsed.data.note },
    });

    const updatedSheet = await syncSheet(userId, year, month);
    await prisma.saleEntry.update({ where: { id: entry.id }, data: { sheetId: updatedSheet.id } });
    imported++;
  }

  revalidatePath("/incentives");
  return { imported, skipped, errors };
}
