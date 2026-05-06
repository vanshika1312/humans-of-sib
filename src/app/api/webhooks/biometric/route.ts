import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/biometric
 *
 * Secured with header: Authorization: Bearer (same value as BIOMETRIC_WEBHOOK_SECRET env)
 * Body JSON:
 *   { "email": "user@domain.in", "date": "2026-05-02",
 *     "checkIn": "2026-05-02T09:30:00.000Z", "checkOut"?: "...",
 *     "externalRef"?: "device-row-id", "mode"?: "OFFICE"|"WFH" }
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
    checkOut?: string;
    externalRef?: string;
    mode?: "OFFICE" | "WFH";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !body.date || !body.checkIn) {
    return NextResponse.json({ error: "email, date, and checkIn required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const dateParts = body.date.split("-").map(Number);
  const rowDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0, 0);
  const checkIn = new Date(body.checkIn);
  const checkOut = body.checkOut ? new Date(body.checkOut) : null;
  const mode = body.mode ?? "OFFICE";

  await prisma.attendance.upsert({
    where: { userId_date: { userId: user.id, date: rowDate } },
    create: {
      userId: user.id,
      date: rowDate,
      checkIn,
      checkOut,
      mode,
      source: "BIOMETRIC",
      externalRef: body.externalRef ?? null,
    },
    update: {
      checkIn,
      checkOut: checkOut ?? undefined,
      mode,
      source: "BIOMETRIC",
      ...(body.externalRef ? { externalRef: body.externalRef } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
