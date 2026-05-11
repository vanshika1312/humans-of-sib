import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calendarDateFromInput } from "@/lib/calendar-date";
import type { BiometricAttendanceCode } from "@/generated/prisma";
import {
  parseBiometricVendorCode,
  resolveBiometricAbsentDayNote,
} from "@/lib/biometric-attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/biometric
 *
 * Secured with header: Authorization: Bearer (same value as BIOMETRIC_WEBHOOK_SECRET env)
 *
 * Body JSON (backward compatible):
 *   { "email", "date", "checkIn", "checkOut"?, "externalRef"?, "mode"? }
 *
 * Extended with device day code (optional):
 *   `code` or `statusCode`: "P"|"A"|"LT"|"EL"|"MO"|"MI"
 *   - P  = Present (default when `code` omitted and `checkIn` sent)
 *   - A  = Absent — no punch; `checkIn`/`checkOut` ignored. Note is filled from leave overlap or "Uninformed absence".
 *   - LT = Late arrival — requires `checkIn` (times as usual)
 *   - EL = Early leave — requires `checkIn` (and `checkOut` when known)
 *   - MO = Missed punch out — requires `checkIn`, `checkOut` optional/null
 *   - MI = Missed punch in — requires `checkOut`, `checkIn` null/omitted
 */
export async function POST(req: NextRequest) {
  const secret = process.env.BIOMETRIC_WEBHOOK_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    email?: string;
    date?: string;
    checkIn?: string;
    checkOut?: string | null;
    externalRef?: string;
    mode?: "OFFICE" | "WFH";
    /** Vendor day code: P, A, LT, EL, MO, MI */
    code?: string;
    statusCode?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !body.date) {
    return NextResponse.json({ error: "email and date required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rowDate = calendarDateFromInput(body.date);
  if (Number.isNaN(rowDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const vendorCode = parseBiometricVendorCode(body.code ?? body.statusCode);
  let biometricCode: BiometricAttendanceCode | null = vendorCode;

  if (!biometricCode && body.checkIn) {
    biometricCode = "PRESENT";
  }

  if (!biometricCode) {
    return NextResponse.json(
      { error: "Provide `code` (e.g. A for absent) or `checkIn` for a present-day punch" },
      { status: 400 },
    );
  }

  const mode = body.mode ?? "OFFICE";

  if (biometricCode === "ABSENT") {
    const note = await resolveBiometricAbsentDayNote(user.id, rowDate);
    await prisma.attendance.upsert({
      where: { userId_date: { userId: user.id, date: rowDate } },
      create: {
        userId: user.id,
        date: rowDate,
        checkIn: null,
        checkOut: null,
        mode,
        source: "BIOMETRIC",
        biometricCode,
        note,
        externalRef: body.externalRef ?? null,
      },
      update: {
        checkIn: null,
        checkOut: null,
        mode,
        source: "BIOMETRIC",
        biometricCode,
        note,
        ...(body.externalRef ? { externalRef: body.externalRef } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  const parseT = (s: string) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  /** undefined = field omitted from payload (preserve on update); null = explicit clear */
  const parseOptionalInstant = (v: string | null | undefined): Date | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    return parseT(v);
  };

  const existing = await prisma.attendance.findUnique({
    where: { userId_date: { userId: user.id, date: rowDate } },
  });

  let checkIn: Date | null | undefined = parseOptionalInstant(body.checkIn);
  let checkOut: Date | null | undefined = parseOptionalInstant(body.checkOut);

  switch (biometricCode) {
    case "MISSED_IN": {
      const out = checkOut;
      if (out === undefined || out === null) {
        return NextResponse.json({ error: "Missed in (MI): checkOut required" }, { status: 400 });
      }
      checkIn = null;
      checkOut = out;
      break;
    }
    case "MISSED_OUT": {
      const inn = checkIn;
      if (inn === undefined || inn === null) {
        return NextResponse.json({ error: "Missed out (MO): checkIn required" }, { status: 400 });
      }
      checkIn = inn;
      if (checkOut === undefined) checkOut = null;
      break;
    }
    default: {
      const inn = checkIn;
      if (inn === undefined || inn === null) {
        return NextResponse.json(
          { error: `${biometricCode}: checkIn required` },
          { status: 400 },
        );
      }
      checkIn = inn;
      break;
    }
  }

  const mergedIn =
    checkIn === undefined ? (existing?.checkIn ?? null) : checkIn;
  const mergedOut =
    checkOut === undefined ? (existing?.checkOut ?? null) : checkOut;

  await prisma.attendance.upsert({
    where: { userId_date: { userId: user.id, date: rowDate } },
    create: {
      userId: user.id,
      date: rowDate,
      checkIn: mergedIn,
      checkOut: mergedOut,
      mode,
      source: "BIOMETRIC",
      biometricCode,
      externalRef: body.externalRef ?? null,
    },
    update: {
      checkIn: mergedIn,
      checkOut: mergedOut,
      mode,
      source: "BIOMETRIC",
      biometricCode,
      ...(body.externalRef ? { externalRef: body.externalRef } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
