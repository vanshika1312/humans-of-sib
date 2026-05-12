import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { manageableEmployeesWhere, type AttendanceApproverContext } from "@/lib/attendance-scope";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatTime } from "@/lib/utils";
import {
  payrollReportLateFlag,
  payrollReportHalfDayFlag,
  REPORT_HALF_DAY_IF_HOURS_BELOW,
  REPORT_MIN_HOURS_FOR_HALF_DAY,
} from "@/lib/payroll-attendance-report";
import type { AttendancePageQs } from "./attendance-route-state";
import { deriveAttendanceRouteState } from "./attendance-route-state";
import { FULL_MONTHS, modeStyle, type AttendanceMode } from "./attendance-shared";

export async function AttendanceApproverTeam({ qs }: { qs: AttendancePageQs }) {
  const me = await requireAppViewer();
  if (!me) return null;

  const route = deriveAttendanceRouteState(qs);
  const {
    activeTab,
    today,
    viewYear,
    viewMonth,
    viewMonthStart,
    viewMonthEnd,
    isViewingCurrentMonth,
    workingDaysForMonthRate,
  } = route;

  const isApprover = ["MANAGER", "DEPT_HEAD", "HR", "CEO", "ADMIN"].includes(me.role);
  if (!isApprover || activeTab !== "attendance") return null;

  const viewerCtx: AttendanceApproverContext = {
    id: me.id,
    role: me.role,
    headedDeptId: me.headedDept?.id ?? null,
  };

  const teamWhere = manageableEmployeesWhere(viewerCtx);
  const teamUsers = await prisma.user.findMany({
    where: teamWhere,
    select: {
      id: true,
      name: true,
      image: true,
      department: { select: { name: true } },
      city: { select: { name: true } },
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
            where: { date: { gte: viewMonthStart, lte: viewMonthEnd }, userId: { in: teamIds } },
          }),
        ]);

  const todayMap = new Map(filteredTodayRecs.map((r) => [r.userId, r]));
  const teamToday = teamUsers.map((u) => {
    const rec = todayMap.get(u.id);
    return {
      id: u.id,
      name: u.name,
      image: u.image,
      dept: u.department?.name ?? null,
      city: u.city?.name ?? null,
      record: rec ? { mode: rec.mode as AttendanceMode, checkIn: rec.checkIn, checkOut: rec.checkOut } : null,
    };
  });

  const monthlyByUser = new Map<string, typeof filteredMonthRecs>();
  for (const r of filteredMonthRecs) {
    if (!monthlyByUser.has(r.userId)) monthlyByUser.set(r.userId, []);
    monthlyByUser.get(r.userId)!.push(r);
  }

  const teamMonthly = teamUsers.map((u) => {
    const recs = monthlyByUser.get(u.id) ?? [];
    const present = recs.length;
    const manual = recs.filter((r) => r.source === "MANUAL").length;
    const biometric = recs.filter((r) => r.source === "BIOMETRIC").length;
    const regularised = recs.filter((r) => r.source === "REGULARISED").length;
    const ratePct =
      workingDaysForMonthRate > 0 ? Math.min(100, Math.round((present / workingDaysForMonthRate) * 100)) : 0;
    const lateRecs = recs
      .filter((r) => payrollReportLateFlag(r.checkIn, r.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const lateDays = lateRecs.length;
    const lateDatesShort =
      lateRecs.length === 0
        ? ""
        : lateRecs.map((r) => formatDate(r.date, { day: "numeric", month: "short" })).join(", ");
    const halfRecs = recs
      .filter((r) => payrollReportHalfDayFlag(r.checkIn, r.checkOut, r.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const halfDays = halfRecs.length;
    const halfDatesShort =
      halfRecs.length === 0
        ? ""
        : halfRecs.map((r) => formatDate(r.date, { day: "numeric", month: "short" })).join(", ");
    return {
      id: u.id,
      name: u.name,
      image: u.image,
      dept: u.department?.name ?? null,
      present,
      office: recs.filter((r) => r.mode === "OFFICE").length,
      wfh: recs.filter((r) => r.mode === "WFH").length,
      ratePct,
      manual,
      biometric,
      regularised,
      lateDays,
      lateDatesShort,
      halfDays,
      halfDatesShort,
    };
  });

  const checkedIn = teamToday.filter((u) => u.record !== null);
  const notYet = teamToday.filter((u) => u.record === null);

  return (
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
                    const ri = u.record!.checkIn;
                    const ro = u.record!.checkOut;
                    const sub = u.dept ?? u.city;
                    return (
                      <li key={u.id} className="flex items-center gap-2.5">
                        <Avatar src={u.image} name={u.name} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink-700 truncate">{u.name}</div>
                          <div className="text-xs text-ink-600 tabular-nums">
                            In {ri ? formatTime(ri) : "—"} · Out {ro ? formatTime(ro) : "—"}
                          </div>
                          {sub ? <div className="text-[11px] text-ink-400 truncate">{sub}</div> : null}
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
          Team metrics — {FULL_MONTHS[viewMonth - 1]} {viewYear}
        </h2>
        <p className="text-xs text-ink-400 mb-3">
          Rate = days with a punch ÷ working weekdays{" "}
          {isViewingCurrentMonth
            ? "from the 1st through today (Mon–Sat, Sun off)"
            : "in this month (Mon–Sat, Sun off)"}
          . Bio / App / Reg = how those days were recorded. <span className="font-medium text-ink-500">Late</span> /{" "}
          <span className="font-medium text-ink-500">Half</span> use the same rules as the payroll report (detail export).
        </p>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-100 text-[10.5px] text-ink-400 uppercase tracking-wide font-semibold">
                  <th className="text-left py-3 px-5">Person</th>
                  <th className="text-left py-3 px-5">Cluster</th>
                  <th className="text-center py-3 px-3">Rate</th>
                  <th className="text-center py-3 px-3">Late</th>
                  <th
                    className="text-center py-3 px-3"
                    title={`Mon–Sat, Sun off: both punches, hours &gt; ${REPORT_MIN_HOURS_FOR_HALF_DAY} and &lt; ${REPORT_HALF_DAY_IF_HOURS_BELOW}`}
                  >
                    Half
                  </th>
                  <th className="text-center py-3 px-3">Present</th>
                  <th className="text-center py-3 px-3">🏢</th>
                  <th className="text-center py-3 px-3">🏠</th>
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
                    <td className="py-3.5 px-3 text-center align-top">
                      {u.lateDays > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-orange-700">{u.lateDays}</span>
                          <div className="text-[10px] text-ink-500 leading-snug max-w-[10rem] mx-auto whitespace-normal">
                            {u.lateDatesShort}
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center align-top">
                      {u.halfDays > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-amber-800">{u.halfDays}</span>
                          <div className="text-[10px] text-ink-500 leading-snug max-w-[10rem] mx-auto whitespace-normal">
                            {u.halfDatesShort}
                          </div>
                        </div>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center font-semibold text-ink-700">{u.present}</td>
                    <td className="py-3.5 px-3 text-center text-sky-600">{u.office || "—"}</td>
                    <td className="py-3.5 px-3 text-center text-amber-600">{u.wfh || "—"}</td>
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
  );
}
