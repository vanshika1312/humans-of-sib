import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { firstSearchParam } from "@/lib/search-param";
import {
  PULSE_ADMIN_ROLES,
  calendarDateToParam,
  getPulseWeekConfig,
  loadPulseAdminSnapshot,
  parseWeekStartParam,
} from "@/lib/pulse";
import { setPulseWeekQuestion } from "./actions";
import { PulseWeekNav } from "./_components/pulse-week-nav";
import { PulseAdminTrendChart } from "./_components/pulse-admin-trend-chart";

export default function AdminPulsePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[]; saved?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <AdminPulsePageBody searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminPulsePageBody({
  searchParams,
}: {
  searchParams: Promise<{ week?: string | string[]; saved?: string | string[] }>;
}) {
  const me = await requireAppViewer();
  if (!me || !(PULSE_ADMIN_ROLES as readonly string[]).includes(me.role)) {
    redirect("/home");
  }

  const sp = await searchParams;
  const weekParam = firstSearchParam(sp.week) ?? calendarDateToParam(parseWeekStartParam(undefined));
  const weekStart = parseWeekStartParam(weekParam);
  const flashSaved = firstSearchParam(sp.saved) === "1";

  const [snapshot, weekConfig] = await Promise.all([
    loadPulseAdminSnapshot(weekStart),
    getPulseWeekConfig(weekStart),
  ]);

  const maxDist = Math.max(1, ...snapshot.distribution.map((d) => d.count));

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Weekly Pulse"
        emoji="💗"
        subtitle="Team sentiment for the week — scores and participation only. Comments stay private to each person."
        action={
          <Link href="/admin">
            <Button variant="outline" size="md">
              ← Admin
            </Button>
          </Link>
        }
      />

      {flashSaved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          This week&apos;s pulse question was saved.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PulseWeekNav weekStart={weekStart} weekParam={weekParam} />
        {!weekConfig.fromDatabase && (
          <Badge tone="ink">Default question</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week&apos;s question</CardTitle>
          <CardDescription>
            Shown on the Pulse page and home feed for week of {formatDate(weekStart)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={setPulseWeekQuestion} className="space-y-4 max-w-2xl">
            <input type="hidden" name="weekStart" value={weekParam} />
            <div>
              <Label htmlFor="promptLabel">Attribution (optional)</Label>
              <Input
                id="promptLabel"
                name="promptLabel"
                defaultValue={weekConfig.promptLabel}
                placeholder="Ritvik · CPO"
              />
            </div>
            <div>
              <Label htmlFor="question">Question</Label>
              <Textarea
                id="question"
                name="question"
                rows={3}
                required
                defaultValue={weekConfig.question}
                placeholder="How are you feeling about work this week?"
              />
            </div>
            <Button type="submit" variant="accent">
              Save question for this week
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Team size" value={`${snapshot.activeCount}`} />
        <Stat
          label="Responded"
          value={`${snapshot.responseCount}${snapshot.participationPct != null ? ` (${snapshot.participationPct}%)` : ""}`}
        />
        <Stat label="Avg score" value={snapshot.avgScore != null ? `${snapshot.avgScore} / 5` : "—"} />
        <Stat
          label="Question"
          value={weekConfig.fromDatabase ? "Custom" : "Default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score distribution</CardTitle>
            <CardDescription>How the team rated this week (no names).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.distribution.map((d) => (
              <div key={d.score} className="flex items-center gap-3">
                <span className="w-6 text-sm font-medium text-ink-500 tabular-nums">{d.score}</span>
                <div className="flex-1 h-3 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-orange-400 transition-all"
                    style={{ width: `${(d.count / maxDist) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm text-ink-600 tabular-nums">{d.count}</span>
              </div>
            ))}
            {snapshot.responseCount === 0 && (
              <p className="text-sm text-ink-400 text-center py-4">No responses for this week yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">8-week trend</CardTitle>
            <CardDescription>Team average score by week.</CardDescription>
          </CardHeader>
          <CardContent>
            <PulseAdminTrendChart points={snapshot.weeklyTrend} highlightWeek={weekStart} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">By department</CardTitle>
          <CardDescription>Participation and average score — aggregated only.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Responded
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-400 uppercase tracking-wider">
                    Avg
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshot.byDepartment.map((row) => (
                  <tr key={row.departmentId ?? "none"} className="border-b border-ink-100 last:border-b-0">
                    <td className="px-5 py-3 text-ink-700">{row.departmentName}</td>
                    <td className="px-5 py-3 text-right text-ink-600 tabular-nums">
                      {row.responseCount} / {row.activeCount}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-600 tabular-nums">
                      {row.avgScore != null ? `${row.avgScore}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-ink-400">
        Private comments are never shown here. Only each person can see their own notes on{" "}
        <Link href="/pulse" className="text-sky-600 hover:underline">
          Pulse
        </Link>
        .
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl border border-ink-100 bg-white">
      <div className="text-xs text-ink-400">{label}</div>
      <div className="text-lg font-bold text-ink-700 mt-0.5">{value}</div>
    </div>
  );
}
