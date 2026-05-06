"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calendarDateFromInput } from "@/lib/calendar-date";
import { PAYROLL_REPORT_ROLES } from "@/lib/payroll-attendance-report";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import type { AttendanceMode, AttendanceSource } from "@/generated/prisma";

export type AttendanceCsvImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

const ATTENDANCE_MODES = new Set<AttendanceMode>(["OFFICE", "WFH"]);
const ATTENDANCE_SOURCES = new Set<AttendanceSource>(["MANUAL", "BIOMETRIC", "REGULARISED"]);

/**
 * Calendar day for import: DD-MM-YYYY (preferred) or legacy YYYY-MM-DD → storage via calendarDateFromInput;
 * `ymdIso` is always YYYY-MM-DD for IST timestamp composition.
 */
function parseAttendanceCsvDate(raw: string): { ymdIso: string; dateOnly: Date } | null {
  const s = raw.trim();
  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s);
  if (dmy) {
    const da = parseInt(dmy[1], 10);
    const mo = parseInt(dmy[2], 10);
    const y = parseInt(dmy[3], 10);
    if (!Number.isFinite(da) || !Number.isFinite(mo) || !Number.isFinite(y)) return null;
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    const ymdIso = `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
    const dateOnly = calendarDateFromInput(ymdIso);
    if (Number.isNaN(dateOnly.getTime())) return null;
    if (dateOnly.getUTCFullYear() !== y || dateOnly.getUTCMonth() + 1 !== mo || dateOnly.getUTCDate() !== da) {
      return null;
    }
    return { ymdIso, dateOnly };
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) {
    const ymdIso = `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
    const dateOnly = calendarDateFromInput(ymdIso);
    if (Number.isNaN(dateOnly.getTime())) return null;
    return { ymdIso, dateOnly };
  }
  return null;
}

/** ymdIso (YYYY-MM-DD) + HH:MM interpreted in Asia/Kolkata (IST, +05:30, no DST). */
function istDateTime(ymdIso: string, hhmmRaw: string): Date | null {
  const hhmm = hhmmRaw.trim();
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = m[1].padStart(2, "0");
  const mi = m[2];
  const iso = `${ymdIso}T${hh}:${mi}:00+05:30`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return "";
}

async function assertPayrollReportAccess(): Promise<{ ok: false; error: string } | { ok: true }> {
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: "Unauthorized." };
  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!me || !(PAYROLL_REPORT_ROLES as readonly string[]).includes(me.role)) {
    return { ok: false, error: "Only CEO / Admin / HR can import attendance CSV." };
  }
  return { ok: true };
}

export async function importAttendanceTestCsv(
  _prev: AttendanceCsvImportResult,
  formData: FormData,
): Promise<AttendanceCsvImportResult> {
  const gate = await assertPayrollReportAccess();
  if (!gate.ok) return { imported: 0, skipped: 0, errors: [gate.error] };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { imported: 0, skipped: 0, errors: ["No file uploaded."] };

  const defaultEmail = String(formData.get("defaultEmail") ?? "")
    .trim()
    .toLowerCase();

  const text = await file.text();
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  if (parsed.errors.length > 0) {
    return { imported: 0, skipped: 0, errors: [`CSV parse error: ${parsed.errors[0]?.message ?? "unknown"}`] };
  }

  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  const userCache = new Map<string, string | null>();
  async function resolveUserId(emailRaw: string): Promise<string | null> {
    const email = emailRaw.trim().toLowerCase();
    if (!email) return null;
    if (userCache.has(email)) return userCache.get(email)!;
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const id = u?.id ?? null;
    userCache.set(email, id);
    return id;
  }

  for (let i = 0; i < parsed.data.length; i++) {
    const rowNum = i + 2;
    const row = parsed.data[i];

    const email = cell(row, "email").toLowerCase() || defaultEmail;
    const dateStr = cell(row, "date");
    const checkInStr = cell(row, "check_in_ist", "check_in", "checkin");
    const checkOutStr = cell(row, "check_out_ist", "check_out", "checkout");
    const modeStr = cell(row, "mode") || "OFFICE";
    const sourceStr = cell(row, "source") || "MANUAL";
    const noteStr = cell(row, "note");

    if (!email && !dateStr && !checkInStr && !checkOutStr) {
      skipped++;
      continue;
    }

    if (!email) {
      errors.push(`Row ${rowNum}: missing email (add an email column or set Default employee email below).`);
      skipped++;
      continue;
    }

    const parsedDate = parseAttendanceCsvDate(dateStr);
    if (!parsedDate) {
      errors.push(`Row ${rowNum}: invalid or missing date (use DD-MM-YYYY, e.g. 05-04-2026).`);
      skipped++;
      continue;
    }
    const { ymdIso, dateOnly } = parsedDate;

    if (!checkInStr) {
      errors.push(`Row ${rowNum}: check_in_ist (or check_in) is required.`);
      skipped++;
      continue;
    }

    const checkIn = istDateTime(ymdIso, checkInStr);
    if (!checkIn) {
      errors.push(`Row ${rowNum}: invalid check-in time "${checkInStr}" (use HH:MM, 24h).`);
      skipped++;
      continue;
    }

    let checkOut: Date | null = null;
    if (checkOutStr) {
      checkOut = istDateTime(ymdIso, checkOutStr);
      if (!checkOut) {
        errors.push(`Row ${rowNum}: invalid check-out time "${checkOutStr}" (use HH:MM, 24h).`);
        skipped++;
        continue;
      }
    }

    const mode = modeStr.toUpperCase() as AttendanceMode;
    if (!ATTENDANCE_MODES.has(mode)) {
      errors.push(`Row ${rowNum}: mode must be OFFICE or WFH (got "${modeStr}").`);
      skipped++;
      continue;
    }

    const source = sourceStr.toUpperCase() as AttendanceSource;
    if (!ATTENDANCE_SOURCES.has(source)) {
      errors.push(`Row ${rowNum}: source must be MANUAL, BIOMETRIC, or REGULARISED (got "${sourceStr}").`);
      skipped++;
      continue;
    }

    const userId = await resolveUserId(email);
    if (!userId) {
      errors.push(`Row ${rowNum}: no user found for "${email}".`);
      skipped++;
      continue;
    }

    const note = [noteStr, "csv-import"].filter(Boolean).join(" · ") || undefined;

    await prisma.attendance.upsert({
      where: { userId_date: { userId, date: dateOnly } },
      create: {
        userId,
        date: dateOnly,
        checkIn,
        checkOut,
        mode,
        source,
        note,
      },
      update: {
        checkIn,
        checkOut,
        mode,
        source,
        note,
      },
    });
    imported++;
  }

  revalidatePath("/admin/attendance-report");
  revalidatePath("/attendance");

  return { imported, skipped, errors };
}
