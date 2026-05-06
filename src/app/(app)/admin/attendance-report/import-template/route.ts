import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PAYROLL_REPORT_ROLES } from "@/lib/payroll-attendance-report";

const TEMPLATE = [
  "email,date,check_in_ist,check_out_ist,mode,source,note",
  "paste-employee-email@example.com,01-04-2026,09:15,18:30,OFFICE,MANUAL,",
  "paste-employee-email@example.com,02-04-2026,10:20,18:00,WFH,MANUAL,half test",
].join("\n");

export async function GET() {
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

  return new NextResponse(TEMPLATE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="attendance-import-template.csv"',
    },
  });
}
