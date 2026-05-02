import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { manageableEmployeesWhere, canApproveForEmployee, type AttendanceApproverContext } from "@/lib/attendance-scope";
import { workingDaysInclusive } from "@/lib/attendance-metrics";
import {
  casualEntitled,
  casualRemaining,
  getHalfYearPeriod,
  isOnProbation,
  sickEntitledPerHalf,
  sickRemaining,
} from "@/lib/leave-policy";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select, Label, Textarea } from "@/components/ui/input";
import { formatDate, formatTime } from "@/lib/utils";
import {
  submitCheckInForm,
  submitCheckOut,
  ensureLeaveBalanceRow,
  submitRegularisationForm,
  reviewRegularisationForm,
  submitLeaveRequestForm,
  reviewLeaveForm,
} from "./actions";

const FULL_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
type AttendanceMode = "OFFICE" | "WFH" | "FIELD";

function modeStyle(mode: AttendanceMode) {
  if (mode === "WFH")   return { bg: "bg-amber-100 text-amber-700",  pill: "bg-amber-50 text-amber-700",  label: "🏠 WFH"   };
  if (mode === "FIELD") return { bg: "bg-orange-100 text-orange-700", pill: "bg-orange-50 text-orange-700", label: "🚶 Field" };
  return                       { bg: "bg-sky-100 text-sky-700",       pill: "bg-sky-50 text-sky-700",       label: "🏢 Office" };
}

function sourceBadgeTone(src: string): "sky" | "sun" | "orange" | "ink" {
  if (src === "BIOMETRIC") return "orange";
  if (src === "REGULARISED") return "sun";
  return "sky";
}

function sourceShort(src: string) {
  if (src === "BIOMETRIC") return "Bio";
  if (src === "REGULARISED") return "Reg";
  return "App";
}

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export default async function AttendancePage() {
  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    select: {
      id: true,
      name: true,
      role: true,
      joinedAt: true,
      probationEndsAt: true,
      headedDept: { select: { id: true } },
    },
  });
  if (!me) return null;

  const viewerCtx: AttendanceApproverContext = {
    id: me.id,
    role: me.role,
    headedDeptId: me.headedDept?.id ?? null,
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const year  = today.getFullYear();
  const month = today.getMonth();
  const monthStart = new Date(year, month, 1);
  const { periodYear: leavePeriodYear, half: leaveHalf } = getHalfYearPeriod(today);

  const isApprover = ["MANAGER", "DEPT_HEAD", "HR", "CEO", "ADMIN"].includes(me.role);

  await ensureLeaveBalanceRow(me.id, today);

  const biometricConfigured = !!process.env.BIOMETRIC_WEBHOOK_SECRET;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    "";

  const [
    todayRecord,
    monthRecords,
    leaveBalance,
    myRegularisations,
    myLeaveRequests,
    pendingRegularisationsAll,
    pendingLeavesAll,
  ] = await Promise.all([
    prisma.attendance.findUnique({
      where: { userId_date: { userId: me.id, date: today } },
    }),
    prisma.attendance.findMany({
      where: { userId: me.id, date: { gte: monthStart } },
      orderBy: { date: "desc" },
    }),
    prisma.leaveBalance.findUnique({
      where: {
        userId_periodYear_half: {
          userId: me.id,
          periodYear: leavePeriodYear,
          half: leaveHalf,
        },
      },
    }),
    prisma.regularisationRequest.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.leaveRequest.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    isApprover
      ? prisma.regularisationRequest.findMany({
          where: { status: "PENDING" },
          include: {
            user: { select: { id: true, name: true, image: true, managerId: true, departmentId: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    isApprover
      ? prisma.leaveRequest.findMany({
          where: { status: "PENDING" },
          include: {
            user: { select: { id: true, name: true, image: true, managerId: true, departmentId: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const pendingRegularisations = pendingRegularisationsAll.filter((r) =>
    canApproveForEmployee(viewerCtx, r.user),
  );
  const pendingLeaves = pendingLeavesAll.filter((r) => canApproveForEmployee(viewerCtx, r.user));

  const workingDaysMonthToDate = workingDaysInclusive(monthStart, today);

  let teamToday: {
    id: string;
    name: string | null;
    image: string | null;
    dept: string | null;
    city: string | null;
    record: { mode: AttendanceMode; checkIn: Date | null } | null;
  }[] = [];

  let teamMonthly: {
    id: string;
    name: string | null;
    image: string | null;
    dept: string | null;
    present: number;
    office: number;
    wfh: number;
    field: number;
    ratePct: number;
    manual: number;
    biometric: number;
    regularised: number;
  }[] = [];

  if (isApprover) {
    const teamWhere = manageableEmployeesWhere(viewerCtx);
    const teamUsers = await prisma.user.findMany({
      where: teamWhere,
      select: {
        id: true,
        name: true,
        image: true,
        department: { select: { name: true } },
        city:       { select: { name: true } },
      },
      orderBy: { name: "asc" },
    });
    const teamIds = teamUsers.map((u) => u.id);

    const [filteredTodayRecs, filteredMonthRecs] =
      teamIds.length === 0
        ? [[], []]
        : await Promise.all([
            prisma.attendance.findMany({ where: { date: today, userId: { in: teamIds } } }),
            prisma.attendance.findMany({
              where: { date: { gte: monthStart }, userId: { in: teamIds } },
            }),
          ]);

    const todayMap = new Map(filteredTodayRecs.map((r) => [r.userId, r]));
    teamToday = teamUsers.map((u) => {
      const rec = todayMap.get(u.id);
      return {
        id: u.id,
        name: u.name,
        image: u.image,
        dept: u.department?.name ?? null,
        city: u.city?.name ?? null,
        record: rec ? { mode: rec.mode as AttendanceMode, checkIn: rec.checkIn } : null,
      };
    });

    const monthlyByUser = new Map<string, typeof filteredMonthRecs>();
    for (const r of filteredMonthRecs) {
      if (!monthlyByUser.has(r.userId)) monthlyByUser.set(r.userId, []);
      monthlyByUser.get(r.userId)!.push(r);
    }

    teamMonthly = teamUsers.map((u) => {
      const recs = monthlyByUser.get(u.id) ?? [];
      const present = recs.length;
      const manual = recs.filter((r) => r.source === "MANUAL").length;
      const biometric = recs.filter((r) => r.source === "BIOMETRIC").length;
      const regularised = recs.filter((r) => r.source === "REGULARISED").length;
      const ratePct =
        workingDaysMonthToDate > 0 ? Math.min(100, Math.round((present / workingDaysMonthToDate) * 100)) : 0;
      return {
        id: u.id,
        name: u.name,
        image: u.image,
        dept: u.department?.name ?? null,
        present,
        office: recs.filter((r) => r.mode === "OFFICE").length,
        wfh: recs.filter((r) => r.mode === "WFH").length,
        field: recs.filter((r) => r.mode === "FIELD").length,
        ratePct,
        manual,
        biometric,
        regularised,
      };
    });
  }

  const checkedIn = teamToday.filter((u) => u.record !== null);
  const notYet    = teamToday.filter((u) => u.record === null);

  const onProbationLeave = isOnProbation(me.probationEndsAt, today);
  const casualUsed = leaveBalance?.casualUsed ?? 0;
  const sickUsed = leaveBalance?.sickUsed ?? 0;
  const casualEntitledNow = casualEntitled(me.probationEndsAt, me.joinedAt, today);
  const casualRemNow = casualRemaining({
    probationEndsAt: me.probationEndsAt,
    joinedAt: me.joinedAt,
    refDate: today,
    casualUsed,
  });
  const sickEntitledNow = sickEntitledPerHalf(me.probationEndsAt, today);
  const sickRemNow = sickRemaining({
    probationEndsAt: me.probationEndsAt,
    refDate: today,
    sickUsed,
  });
  const halfLabel =
    leaveHalf === 1 ? `Jan–Jun ${leavePeriodYear}` : `Jul–Dec ${leavePeriodYear}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        emoji="🟢"
        subtitle="Check in, biometric sync, leave bank, regularisation — all in one place."
      />

      {/* ── Today ───────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="p-5 md:p-6 brand-gradient text-white">
          <div className="text-sm opacity-80 uppercase tracking-wide font-medium">
            {formatDate(today, { weekday: "long" })}
          </div>
          <div className="text-2xl md:text-3xl font-bold">{formatDate(today)}</div>
        </div>
        <CardContent className="pt-5">
          {todayRecord?.checkIn ? (
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge tone="green">Checked in {formatTime(todayRecord.checkIn)}</Badge>
                <Badge tone={todayRecord.mode === "WFH" ? "sun" : todayRecord.mode === "FIELD" ? "orange" : "sky"}>
                  {modeStyle(todayRecord.mode as AttendanceMode).label}
                </Badge>
                <Badge tone={sourceBadgeTone(todayRecord.source)}>{sourceShort(todayRecord.source)}</Badge>
                {todayRecord.checkOut && (
                  <Badge tone="ink">Checked out {formatTime(todayRecord.checkOut)}</Badge>
                )}
              </div>
              {todayRecord.note && (
                <p className="text-sm text-ink-500 mt-2 italic">&quot;{todayRecord.note}&quot;</p>
              )}
              {!todayRecord.checkOut && (
                <form action={submitCheckOut} className="mt-4">
                  <Button type="submit" variant="outline">Check out →</Button>
                </form>
              )}
            </div>
          ) : (
            <form action={submitCheckInForm} className="grid md:grid-cols-[1fr,1fr,auto] gap-3 items-end">
              <div>
                <Label htmlFor="mode">Mode</Label>
                <Select id="mode" name="mode" defaultValue="OFFICE">
                  <option value="OFFICE">🏢 Office</option>
                  <option value="WFH">🏠 Work from home</option>
                  <option value="FIELD">🚶 Field / travel</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="note">Note (optional)</Label>
                <Input id="note" name="note" placeholder="What are you focused on today?" />
              </div>
              <Button type="submit" size="lg" variant="accent">Check in</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ── Biometric integration ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="size-12 rounded-xl bg-ink-50 flex items-center justify-center text-2xl shrink-0">📟</div>
            <div className="flex-1 min-w-[220px] space-y-2">
              <h2 className="font-semibold text-ink-700">Biometric integration</h2>
              <p className="text-sm text-ink-500">
                Push punches from your attendance hardware into Humans of SIB via a secure webhook.
                Each event upserts the employee&apos;s row for that calendar day with source{" "}
                <span className="font-medium text-ink-600">Bio</span>.
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <Badge tone={biometricConfigured ? "green" : "ink"}>
                  {biometricConfigured ? "Webhook secret configured" : "Not configured"}
                </Badge>
                {!biometricConfigured && (
                  <span className="text-xs text-ink-400">
                    Set <code className="bg-ink-100 px-1 rounded">BIOMETRIC_WEBHOOK_SECRET</code> in env to enable.
                  </span>
                )}
              </div>
              {biometricConfigured && baseUrl && (
                <p className="text-xs text-ink-400 break-all">
                  Endpoint:{" "}
                  <span className="font-mono text-ink-600">{baseUrl}/api/webhooks/biometric</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Leave bank + apply ───────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-ink-700 mb-1">Leave bank · {halfLabel}</h2>
            <p className="text-xs text-ink-400 mb-4">
              Casual accrues 1 working month at a time (unused rolls within this half). Sick: 3 per half.
              Balances reset after Jun 30 and Dec 31.
            </p>
            {onProbationLeave ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 mb-4">
                You&apos;re on probation until{" "}
                {me.probationEndsAt ? formatDate(me.probationEndsAt) : "confirmed"} — no paid casual/sick yet.
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <MiniBank
                label="Casual remaining"
                left={casualRemNow}
                total={casualEntitledNow}
                subtitle={`used ${casualUsed}`}
              />
              <MiniBank
                label="Sick remaining"
                left={sickRemNow}
                total={sickEntitledNow}
                subtitle={`used ${sickUsed}`}
              />
            </div>
            <p className="text-xs text-ink-400 mt-3">
              HR sets probation end date on your profile; splits Jun/Jul or Dec/Jan deduct from each half separately.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-ink-700 mb-4">Apply for leave</h2>
            <form action={submitLeaveRequestForm} className="space-y-3">
              <div>
                <Label htmlFor="leaveType">Type</Label>
                <Select id="leaveType" name="leaveType" defaultValue="CASUAL">
                  <option value="CASUAL">Casual</option>
                  <option value="SICK">Sick</option>
                  <option value="MENSTRUAL">Menstrual</option>
                  <option value="BEREAVEMENT">Bereavement</option>
                  <option value="WEDDING">Wedding</option>
                  <option value="UNPAID">Unpaid</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="leaveStart">From</Label>
                  <Input id="leaveStart" name="leaveStart" type="date" defaultValue={isoLocal(monthStart)} required />
                </div>
                <div>
                  <Label htmlFor="leaveEnd">To</Label>
                  <Input id="leaveEnd" name="leaveEnd" type="date" defaultValue={isoLocal(today)} required />
                </div>
              </div>
              <div>
                <Label htmlFor="leaveReason">Reason</Label>
                <Textarea id="leaveReason" name="leaveReason" placeholder="Optional context for your manager" />
              </div>
              <Button type="submit" variant="accent">Submit request</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ── Regularisation ───────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-ink-700 mb-2">Regularisation request</h2>
            <p className="text-sm text-ink-500 mb-4">
              Fix a missed or incorrect punch. Your manager or HR will approve — approved rows show as{" "}
              <span className="font-medium text-ink-600">Reg</span> in your log.
            </p>
            <form action={submitRegularisationForm} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="regDate">Date</Label>
                  <Input id="regDate" name="regDate" type="date" required max={isoLocal(today)} defaultValue={isoLocal(today)} />
                </div>
                <div>
                  <Label htmlFor="regMode">Mode</Label>
                  <Select id="regMode" name="regMode" defaultValue="OFFICE">
                    <option value="OFFICE">🏢 Office</option>
                    <option value="WFH">🏠 WFH</option>
                    <option value="FIELD">🚶 Field</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="regCheckIn">Check-in time</Label>
                  <Input id="regCheckIn" name="regCheckIn" type="time" required />
                </div>
                <div>
                  <Label htmlFor="regCheckOut">Check-out time</Label>
                  <Input id="regCheckOut" name="regCheckOut" type="time" />
                </div>
              </div>
              <div>
                <Label htmlFor="reason">Why does this need fixing?</Label>
                <Textarea id="reason" name="reason" required placeholder="e.g. Forgot to check in after client visit" />
              </div>
              <Button type="submit" variant="outline">Submit regularisation</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <h2 className="font-semibold text-ink-700 mb-4">My recent requests</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">Regularisation</h3>
                {myRegularisations.length === 0 ? (
                  <p className="text-sm text-ink-400">None yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {myRegularisations.map((r) => (
                      <li key={r.id} className="text-sm flex items-start justify-between gap-2 flex-wrap">
                        <span className="text-ink-600">{formatDate(r.date)}</span>
                        <Badge tone={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "orange" : "sun"}>
                          {r.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="border-t border-ink-100 pt-4">
                <h3 className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">Leave</h3>
                {myLeaveRequests.length === 0 ? (
                  <p className="text-sm text-ink-400">None yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {myLeaveRequests.map((r) => (
                      <li key={r.id} className="text-sm flex items-start justify-between gap-2 flex-wrap">
                        <span className="text-ink-600">
                          {r.type} · {formatDate(r.startDate)} → {formatDate(r.endDate)}
                        </span>
                        <Badge tone={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "orange" : "sun"}>
                          {r.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Approvals (managers / HR / heads) ─────────────────────────────────── */}
      {isApprover && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-ink-600">Approvals</h2>

          {pendingRegularisations.length === 0 && pendingLeaves.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <p className="text-sm text-ink-400 text-center">No pending regularisation or leave requests in your scope.</p>
              </CardContent>
            </Card>
          )}

          {pendingRegularisations.length > 0 && (
            <Card>
              <div className="px-5 py-3 border-b border-ink-100">
                <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Regularisation ({pendingRegularisations.length})
                </span>
              </div>
              <CardContent className="pt-4 space-y-4">
                {pendingRegularisations.map((r) => (
                  <div key={r.id} className="rounded-lg border border-ink-100 p-4 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Avatar src={r.user.image} name={r.user.name} size="sm" />
                      <span className="font-medium text-ink-700">{r.user.name}</span>
                      <span className="text-sm text-ink-500">{formatDate(r.date)}</span>
                      <Badge tone="sun">{r.requestMode ? modeStyle(r.requestMode as AttendanceMode).label : "—"}</Badge>
                    </div>
                    <p className="text-sm text-ink-600">{r.reason}</p>
                    <p className="text-xs text-ink-400">
                      Proposed: {r.requestCheckIn ? formatTime(r.requestCheckIn) : "—"}
                      {" → "}
                      {r.requestCheckOut ? formatTime(r.requestCheckOut) : "—"}
                    </p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <form action={reviewRegularisationForm} className="flex gap-2 items-end flex-wrap">
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="reviewAction" value="approve" />
                        <Button type="submit" size="sm" variant="accent">Approve</Button>
                      </form>
                      <form action={reviewRegularisationForm} className="flex gap-2 items-end flex-wrap">
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="reviewAction" value="reject" />
                        <Input name="reviewNote" placeholder="Note (optional)" className="h-9 w-44" />
                        <Button type="submit" size="sm" variant="outline">Reject</Button>
                      </form>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {pendingLeaves.length > 0 && (
            <Card>
              <div className="px-5 py-3 border-b border-ink-100">
                <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                  Leave ({pendingLeaves.length})
                </span>
              </div>
              <CardContent className="pt-4 space-y-4">
                {pendingLeaves.map((r) => (
                  <div key={r.id} className="rounded-lg border border-ink-100 p-4 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Avatar src={r.user.image} name={r.user.name} size="sm" />
                      <span className="font-medium text-ink-700">{r.user.name}</span>
                      <Badge tone="sky">{r.type}</Badge>
                    </div>
                    <p className="text-sm text-ink-600">
                      {formatDate(r.startDate)} → {formatDate(r.endDate)}
                    </p>
                    {r.reason && <p className="text-sm text-ink-500 italic">&quot;{r.reason}&quot;</p>}
                    <div className="flex flex-wrap gap-2 items-end">
                      <form action={reviewLeaveForm} className="flex gap-2 items-end flex-wrap">
                        <input type="hidden" name="leaveId" value={r.id} />
                        <input type="hidden" name="leaveReviewAction" value="approve" />
                        <Button type="submit" size="sm" variant="accent">Approve</Button>
                      </form>
                      <form action={reviewLeaveForm} className="flex gap-2 items-end flex-wrap">
                        <input type="hidden" name="leaveId" value={r.id} />
                        <input type="hidden" name="leaveReviewAction" value="reject" />
                        <Input name="leaveReviewNote" placeholder="Note (optional)" className="h-9 w-44" />
                        <Button type="submit" size="sm" variant="outline">Reject</Button>
                      </form>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Monthly log ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-ink-600 mb-3">{FULL_MONTHS[month]} log</h2>
        <Card>
          <CardContent className="pt-4">
            {monthRecords.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-8">No attendance yet this month. Check in above!</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {monthRecords.map((r) => (
                  <li key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
                    <div className="font-medium text-ink-700 w-28 shrink-0">
                      {formatDate(r.date, { day: "2-digit", month: "short", weekday: "short" })}
                    </div>
                    <Badge tone={r.mode === "WFH" ? "sun" : r.mode === "FIELD" ? "orange" : "sky"}>
                      {modeStyle(r.mode as AttendanceMode).label}
                    </Badge>
                    <Badge tone={sourceBadgeTone(r.source)}>{sourceShort(r.source)}</Badge>
                    <span className="text-sm text-ink-500">
                      {formatTime(r.checkIn)} → {r.checkOut ? formatTime(r.checkOut) : "—"}
                    </span>
                    {r.note && (
                      <span className="text-xs text-ink-400 italic truncate max-w-xs">
                        &quot;{r.note}&quot;
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Team dashboard (scoped) ───────────────────────────────────────────── */}
      {isApprover && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-ink-600 mb-3">
              Team today · {checkedIn.length} checked in · {notYet.length} not yet
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <div className="px-4 py-3 border-b border-ink-100">
                  <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                    Checked In ({checkedIn.length})
                  </span>
                </div>
                <CardContent className="pt-3 pb-4">
                  {checkedIn.length === 0 ? (
                    <p className="text-sm text-ink-400">No one yet</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {checkedIn.map((u) => {
                        const s = modeStyle(u.record!.mode);
                        return (
                          <li key={u.id} className="flex items-center gap-2.5">
                            <Avatar src={u.image} name={u.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-ink-700 truncate">{u.name}</div>
                              <div className="text-xs text-ink-400">{u.dept ?? u.city ?? "—"}</div>
                            </div>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.pill}`}>
                              {s.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <div className="px-4 py-3 border-b border-ink-100">
                  <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                    Not Checked In ({notYet.length})
                  </span>
                </div>
                <CardContent className="pt-3 pb-4">
                  {notYet.length === 0 ? (
                    <p className="text-sm text-green-600 font-medium">Everyone in scope checked in 🎉</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {notYet.map((u) => (
                        <li key={u.id} className="flex items-center gap-2.5">
                          <Avatar src={u.image} name={u.name} size="sm" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-ink-700 truncate">{u.name}</div>
                            <div className="text-xs text-ink-400">{u.dept ?? u.city ?? "—"}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink-600 mb-3">
              Team metrics — {FULL_MONTHS[month]} {year}
            </h2>
            <p className="text-xs text-ink-400 mb-3">
              Rate = days with a punch ÷ working weekdays so far this month (Mon–Fri). Bio / App / Reg = how those days were recorded.
            </p>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-ink-50 border-b border-ink-100 text-[10.5px] text-ink-400 uppercase tracking-wide font-semibold">
                      <th className="text-left py-3 px-5">Person</th>
                      <th className="text-left py-3 px-5">Cluster</th>
                      <th className="text-center py-3 px-3">Rate</th>
                      <th className="text-center py-3 px-3">Present</th>
                      <th className="text-center py-3 px-3">🏢</th>
                      <th className="text-center py-3 px-3">🏠</th>
                      <th className="text-center py-3 px-3">🚶</th>
                      <th className="text-center py-3 px-3">App</th>
                      <th className="text-center py-3 px-3">Bio</th>
                      <th className="text-center py-3 px-3">Reg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {teamMonthly.map((u) => (
                      <tr key={u.id} className="hover:bg-ink-50/50 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar src={u.image} name={u.name} size="sm" />
                            <span className="font-medium text-ink-700">{u.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-ink-500">{u.dept ?? "—"}</td>
                        <td className="py-3.5 px-3 text-center font-bold text-sky-700">{u.ratePct}%</td>
                        <td className="py-3.5 px-3 text-center font-semibold text-ink-700">{u.present}</td>
                        <td className="py-3.5 px-3 text-center text-sky-600">{u.office || "—"}</td>
                        <td className="py-3.5 px-3 text-center text-amber-600">{u.wfh || "—"}</td>
                        <td className="py-3.5 px-3 text-center text-orange-600">{u.field || "—"}</td>
                        <td className="py-3.5 px-3 text-center text-ink-500">{u.manual || "—"}</td>
                        <td className="py-3.5 px-3 text-center text-ink-500">{u.biometric || "—"}</td>
                        <td className="py-3.5 px-3 text-center text-ink-500">{u.regularised || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniBank({ label, left, total, subtitle }: {
  label: string;
  left: number;
  total: number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg bg-ink-50 p-3">
      <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-ink-700">{Math.max(0, left)}</div>
      <div className="text-[11px] text-ink-400">
        of {total} day{total !== 1 ? "s" : ""} accrued this half
        {subtitle ? ` · ${subtitle}` : ""}
      </div>
    </div>
  );
}
