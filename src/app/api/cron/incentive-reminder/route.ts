import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendIncentiveReminderEmail, type UnpaidSheet } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FULL_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/**
 * GET /api/cron/incentive-reminder
 *
 * Called by Vercel Cron on the 16th of every month at 09:00 IST (03:00 UTC).
 * Checks previous month's IncentiveSheets — any that are not PAID triggers
 * reminder emails to Accounts Managers and Sales Heads.
 *
 * Secured with CRON_SECRET header (set in Vercel env vars).
 * Can also be triggered manually by adding ?force=true in development.
 */
export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isVercelCron = authHeader === `Bearer ${secret}`;
  const isForced     = req.nextUrl.searchParams.get("force") === "true" && process.env.NODE_ENV === "development";

  if (secret && !isVercelCron && !isForced) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Determine which month to check ───────────────────────────────────────
  // Always check the previous calendar month
  const now   = new Date();
  const year  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 12 : now.getMonth(); // getMonth() is 0-indexed

  const monthLabel = `${FULL_MONTHS[month - 1]} ${year}`;

  // ── Find unpaid sheets ────────────────────────────────────────────────────
  const unpaidSheets = await prisma.incentiveSheet.findMany({
    where: {
      year,
      month,
      status: { not: "PAID" },
      // Only sheets that have been worked on (have revenue or are locked/approved)
      OR: [
        { adjustedRevenue: { gt: 0 } },
        { status: { in: ["LOCKED", "APPROVED"] } },
      ],
    },
    include: {
      user: {
        select: {
          name:       true,
          department: { select: { name: true } },
          city:       { select: { name: true } },
        },
      },
    },
  });

  if (unpaidSheets.length === 0) {
    return NextResponse.json({
      ok:      true,
      message: `All incentives for ${monthLabel} are paid. No reminders sent.`,
    });
  }

  // ── Build the payload ─────────────────────────────────────────────────────
  const sheetPayload: UnpaidSheet[] = unpaidSheets.map((s) => ({
    counsellorName: s.user.name ?? "Unknown",
    team:           s.user.city?.name       ?? null,
    cluster:        s.user.department?.name ?? null,
    finalAmount:    s.finalAmount,
    status:         s.status,
  }));

  // ── Find recipients ───────────────────────────────────────────────────────
  // Accounts Managers (ADMIN, HR, CEO) + Sales Heads (MANAGER, DEPT_HEAD)
  const recipients = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      email:  { not: null },
      role:   { in: ["ADMIN", "HR", "CEO", "MANAGER", "DEPT_HEAD"] },
    },
    select: { name: true, email: true },
  });

  // ── Send emails ───────────────────────────────────────────────────────────
  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const r of recipients) {
    if (!r.email) continue;
    try {
      await sendIncentiveReminderEmail({
        to:            r.email,
        recipientName: r.name ?? "Team",
        monthLabel,
        unpaidSheets:  sheetPayload,
      });
      results.push({ email: r.email, ok: true });
    } catch (err) {
      results.push({ email: r.email, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({
    ok:          true,
    month:       monthLabel,
    unpaidCount: unpaidSheets.length,
    emailsSent:  results.filter((r) => r.ok).length,
    results,
  });
}
