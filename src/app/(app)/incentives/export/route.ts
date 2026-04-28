import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));

  const sheets = await prisma.incentiveSheet.findMany({
    where:   { year, month },
    orderBy: { adjustedRevenue: "desc" },
    include: {
      user: { select: { name: true, email: true, department: { select: { name: true } } } },
    },
  });

  const header  = "Counsellor,Email,Department,Revenue,Slab Rate (%),Base Incentive,Adjustment,Final Payout,Status";
  const rows    = sheets.map((s) => [
    `"${s.user.name ?? ""}"`,
    `"${s.user.email ?? ""}"`,
    `"${s.user.department?.name ?? ""}"`,
    s.adjustedRevenue,
    s.slabRate,
    s.incentiveAmount,
    s.manualAdjustment,
    s.finalAmount,
    s.status,
  ].join(","));

  const csv      = [header, ...rows].join("\n");
  const filename = `incentives-${MONTHS[month - 1]}-${year}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
