import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/input";
import { formatDate, formatTime } from "@/lib/utils";
import { submitCheckInForm, submitCheckOut } from "./actions";

export default async function AttendancePage() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me) return null;

  const today = new Date(); today.setHours(0,0,0,0);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [todayRecord, monthRecords] = await Promise.all([
    prisma.attendance.findUnique({ where: { userId_date: { userId: me.id, date: today } } }),
    prisma.attendance.findMany({
      where: { userId: me.id, date: { gte: monthStart } },
      orderBy: { date: "desc" },
    }),
  ]);

  const daysThisMonth = monthRecords.length;
  const wfhDays = monthRecords.filter((r) => r.mode === "WFH").length;
  const officeDays = monthRecords.filter((r) => r.mode === "OFFICE").length;

  return (
    <div>
      <PageHeader title="Attendance" emoji="🟢" subtitle="Check in, check out. Track your month at a glance." />

      {/* Today card */}
      <Card className="mb-6 overflow-hidden">
        <div className="p-5 md:p-6 brand-gradient text-white">
          <div className="text-sm opacity-90">{formatDate(today, { weekday: "long" })}</div>
          <div className="text-2xl md:text-3xl font-bold">{formatDate(today)}</div>
        </div>
        <CardContent className="pt-5">
          {todayRecord?.checkIn ? (
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge tone="green">Checked in at {formatTime(todayRecord.checkIn)}</Badge>
                <Badge tone={todayRecord.mode === "WFH" ? "sun" : todayRecord.mode === "FIELD" ? "orange" : "sky"}>
                  {todayRecord.mode === "WFH" ? "🏠 WFH" : todayRecord.mode === "FIELD" ? "🚶 Field" : "🏢 Office"}
                </Badge>
                {todayRecord.checkOut && (
                  <Badge tone="ink">Checked out at {formatTime(todayRecord.checkOut)}</Badge>
                )}
              </div>
              {todayRecord.note && <p className="text-sm text-ink-500 mt-2">&quot;{todayRecord.note}&quot;</p>}
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

      {/* Month stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="p-4"><div className="text-xs text-ink-400">Days this month</div><div className="text-2xl font-bold text-ink-700">{daysThisMonth}</div></Card>
        <Card className="p-4"><div className="text-xs text-ink-400">In office</div><div className="text-2xl font-bold text-sky-600">{officeDays}</div></Card>
        <Card className="p-4"><div className="text-xs text-ink-400">WFH</div><div className="text-2xl font-bold text-sun-600">{wfhDays}</div></Card>
      </div>

      <h2 className="text-sm font-semibold text-ink-600 mb-3">This month</h2>
      <Card>
        <CardContent className="pt-4">
          {monthRecords.length === 0 ? (
            <div className="text-sm text-ink-400 text-center py-8">No attendance yet this month. Check in above!</div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {monthRecords.map((r) => (
                <li key={r.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <div className="font-medium text-ink-700 w-28">{formatDate(r.date, { day: "2-digit", month: "short", weekday: "short" })}</div>
                  <Badge tone={r.mode === "WFH" ? "sun" : r.mode === "FIELD" ? "orange" : "sky"}>
                    {r.mode === "WFH" ? "🏠 WFH" : r.mode === "FIELD" ? "🚶 Field" : "🏢 Office"}
                  </Badge>
                  <span className="text-sm text-ink-500">
                    {formatTime(r.checkIn)} → {r.checkOut ? formatTime(r.checkOut) : "—"}
                  </span>
                  {r.note && <span className="text-xs text-ink-400 italic truncate max-w-xs">&quot;{r.note}&quot;</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
