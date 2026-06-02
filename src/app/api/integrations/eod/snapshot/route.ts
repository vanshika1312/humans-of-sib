import { NextRequest, NextResponse } from "next/server";
import { buildEodSnapshot } from "@/lib/eod/snapshot";
import { eodIntegrationEnabled, verifyEodIntegrationRequest } from "@/lib/eod/integration-auth";
import { zonedTodayYmd } from "@/lib/eod/zoned-day";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * GET /api/integrations/eod/snapshot?date=YYYY-MM-DD&timezone=Asia/Kolkata
 *
 * Machine-readable daily hiring snapshot for the standalone EOD app.
 * Secured with EOD_INTEGRATION_SECRET (Bearer token).
 *
 * @see docs/eod/integration.md
 */
export async function GET(req: NextRequest) {
  if (!eodIntegrationEnabled()) {
    return NextResponse.json(
      { ok: false, error: "EOD integration is not configured (set EOD_INTEGRATION_SECRET)" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!verifyEodIntegrationRequest(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const timezone = (req.nextUrl.searchParams.get("timezone") ?? DEFAULT_TIMEZONE).trim() || DEFAULT_TIMEZONE;
  let reportDate = (req.nextUrl.searchParams.get("date") ?? "").trim();
  if (!reportDate) {
    try {
      reportDate = zonedTodayYmd(timezone);
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid timezone" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
    return NextResponse.json(
      { ok: false, error: "date must be YYYY-MM-DD" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const snapshot = await buildEodSnapshot({ reportDate, timezone });
    return NextResponse.json(
      { ok: true, snapshot },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build snapshot";
    const status = message.includes("timezone") || message.includes("date") ? 400 : 500;
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
