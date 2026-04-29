import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRevenueFromSheet } from "@/app/(app)/incentives/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sync-revenue
 *
 * Called by Vercel Cron daily at 02:00 UTC (07:30 IST).
 * Finds all IncentivePeriods for the current month that have a sheetUrl set
 * and syncs each one.
 *
 * Also handles the previous month if we're in the first 3 days (catch-up window).
 *
 * Secured with CRON_SECRET. Can be triggered manually in dev with ?force=true.
 */
export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret     = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isVercelCron = authHeader === `Bearer ${secret}`;
  const isForced     =
    req.nextUrl.searchParams.get("force") === "true" &&
    process.env.NODE_ENV === "development";

  if (secret && !isVercelCron && !isForced) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Determine which months to sync ───────────────────────────────────────
  const now   = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Always sync the current month; also sync previous month in the first 3 days
  const monthsToSync: { year: number; month: number }[] = [
    { year: currentYear, month: currentMonth },
  ];
  if (now.getDate() <= 3) {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear  = currentMonth === 1 ? currentYear - 1 : currentYear;
    monthsToSync.push({ year: prevYear, month: prevMonth });
  }

  // ── Find periods with a sheetUrl ─────────────────────────────────────────
  const periods = await prisma.incentivePeriod.findMany({
    where: {
      OR: monthsToSync,
      sheetUrl: { not: null },
    },
    select: { year: true, month: true, sheetUrl: true },
  });

  if (periods.length === 0) {
    return NextResponse.json({
      ok:      true,
      message: "No sheet URLs configured for the current period. Nothing to sync.",
    });
  }

  // ── Sync each period ──────────────────────────────────────────────────────
  const results: {
    year: number;
    month: number;
    imported: number;
    skipped: number;
    errors: string[];
  }[] = [];

  for (const p of periods) {
    try {
      const result = await syncRevenueFromSheet(p.year, p.month);
      results.push({ year: p.year, month: p.month, ...result });
    } catch (err) {
      results.push({
        year: p.year, month: p.month,
        imported: 0, skipped: 0,
        errors: [String(err)],
      });
    }
  }

  return NextResponse.json({ ok: true, synced: results });
}
