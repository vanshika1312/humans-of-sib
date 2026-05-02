import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWeeklyPerformanceEmail, type WeeklyPerformanceData } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FULL_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/**
 * GET /api/cron/weekly-performance
 *
 * Called by Vercel Cron every Monday at 09:00 IST (03:30 UTC).
 * Sends each active counsellor a personalised weekly performance email:
 *   - Revenue generated so far this month
 *   - Cha-Ching Meter (% of target achieved)
 *   - Estimated incentive
 *   - Days left in the month
 *   - Motivating tips based on progress
 *
 * Secured with CRON_SECRET. Can be triggered manually with ?force=true in dev.
 */
export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret      = process.env.CRON_SECRET;
  const authHeader  = req.headers.get("authorization");
  const isVercelCron = authHeader === `Bearer ${secret}`;
  const isForced     = req.nextUrl.searchParams.get("force") === "true" && process.env.NODE_ENV === "development";

  if (secret && !isVercelCron && !isForced) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Current month context ─────────────────────────────────────────────────
  const now        = new Date();
  const year       = now.getFullYear();
  const month      = now.getMonth() + 1; // 1-indexed
  const monthLabel = `${FULL_MONTHS[month - 1]} ${year}`;

  // Days left in the month (inclusive of today)
  const lastDay  = new Date(year, month, 0).getDate();
  const daysLeft = Math.max(0, lastDay - now.getDate() + 1);

  // Week of month (1–5)
  const weekNumber = Math.ceil(now.getDate() / 7);

  // ── Fetch all current-month incentive sheets for active counsellors ────────
  const sheets = await prisma.incentiveSheet.findMany({
    where: { year, month },
    include: {
      user: {
        select: {
          id:    true,
          name:  true,
          email: true,
          status: true,
        },
      },
    },
  });

  // Also get active counsellors with NO sheet yet (so they still get an email)
  const sheetUserIds = new Set(sheets.map((s) => s.user.id));
  const counsellorsWithoutSheet = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role:   "EMPLOYEE",
      email:  { not: null },
      id:     { notIn: [...sheetUserIds] },
    },
    select: { id: true, name: true, email: true },
  });

  // ── Send emails ────────────────────────────────────────────────────────────
  const results: { email: string; ok: boolean; error?: string }[] = [];

  // Counsellors with a sheet
  for (const s of sheets) {
    const user = s.user;
    if (!user.email || user.status !== "ACTIVE") continue;

    const data: WeeklyPerformanceData = {
      counsellorName: user.name ?? "there",
      monthLabel,
      weekNumber,
      revenue:        s.adjustedRevenue,
      target:         s.monthlyTarget,
      incentiveEst:   s.finalAmount,
      slabRate:       s.slabRate,
      daysLeft,
    };

    try {
      await sendWeeklyPerformanceEmail({ to: user.email, data });
      results.push({ email: user.email, ok: true });
    } catch (err) {
      results.push({ email: user.email, ok: false, error: String(err) });
    }
  }

  // Counsellors with no sheet yet (no revenue entered, no target)
  for (const u of counsellorsWithoutSheet) {
    if (!u.email) continue;

    const data: WeeklyPerformanceData = {
      counsellorName: u.name ?? "there",
      monthLabel,
      weekNumber,
      revenue:      0,
      target:       0,
      incentiveEst: 0,
      slabRate:     0,
      daysLeft,
    };

    try {
      await sendWeeklyPerformanceEmail({ to: u.email, data });
      results.push({ email: u.email, ok: true });
    } catch (err) {
      results.push({ email: u.email, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({
    ok:         true,
    month:      monthLabel,
    week:       weekNumber,
    emailsSent: results.filter((r) => r.ok).length,
    failed:     results.filter((r) => !r.ok).length,
    results,
  });
}
