import { NextRequest, NextResponse } from "next/server";
import { syncDueHiringInterviewArtifacts } from "@/lib/hiring-interview-artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sync-interview-artifacts
 *
 * Pulls Google Meet recordings and transcripts for hiring interviews that have ended.
 * Secured with CRON_SECRET. In development, ?force=true skips the secret.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const isVercelCron = authHeader === `Bearer ${secret}`;
  const isForced =
    req.nextUrl.searchParams.get("force") === "true" && process.env.NODE_ENV === "development";

  if (secret && !isVercelCron && !isForced) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncDueHiringInterviewArtifacts();
  return NextResponse.json({ ok: true, ...result });
}
