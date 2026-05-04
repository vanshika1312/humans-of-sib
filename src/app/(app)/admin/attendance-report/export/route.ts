import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  PAYROLL_REPORT_ROLES,
  buildPayrollDetailCsv,
  buildPayrollSummaryCsv,
  fetchPayrollAttendanceReport,
} from "@/lib/payroll-attendance-report";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function clampYear(y: number): number {
  if (!Number.isFinite(y)) return new Date().getFullYear();
  return Math.min(2035, Math.max(2020, y));
}

function clampMonth(m: number): number {
  if (!Number.isFinite(m)) return new Date().getMonth() + 1;
  return Math.min(12, Math.max(1, m));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  });
  if (!me || !(PAYROLL_REPORT_ROLES as readonly string[]).includes(me.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const year = clampYear(parseInt(searchParams.get("year") ?? "", 10));
  const month = clampMonth(parseInt(searchParams.get("month") ?? "", 10));
  const format = searchParams.get("format") === "detail" ? "detail" : "summary";

  const data = await fetchPayrollAttendanceReport(year, month);
  const csv =
    format === "detail" ? buildPayrollDetailCsv(data.details) : buildPayrollSummaryCsv(data.summaries);
  const filename = `attendance-payroll-${format}-${MONTHS[month - 1]}-${year}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
