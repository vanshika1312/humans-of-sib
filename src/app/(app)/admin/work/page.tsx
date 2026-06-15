import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { WORK_ADMIN_ROLES } from "@/lib/work-tracking/access";
import { getWorkTrackingConfig, formatEodDeadline } from "@/lib/work-tracking/config";
import { loadCrossDeptEfficiency } from "@/lib/work-tracking/snapshots";
import { firstSearchParam } from "@/lib/search-param";
import { updateWorkTrackingConfig } from "./actions";

export default function AdminWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <AdminWorkPageBody searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminWorkPageBody({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const me = await requireAppViewer();
  if (!me || !WORK_ADMIN_ROLES.includes(me.role)) redirect("/home");

  const sp = await searchParams;
  const saved = firstSearchParam(sp.saved) === "1";

  const [config, deptRows] = await Promise.all([
    getWorkTrackingConfig(),
    loadCrossDeptEfficiency(),
  ]);

  const flaggedTotal = deptRows.reduce((s, d) => s + d.flaggedCount, 0);
  const avgEfficiency =
    deptRows.length > 0
      ? Math.round(deptRows.reduce((s, d) => s + d.avgEfficiency, 0) / deptRows.length)
      : 0;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Work Tracking"
        emoji="📊"
        subtitle="Cross-department efficiency, EOD compliance, and performance flags."
        action={
          <Link href="/admin">
            <Button variant="outline" size="md">← Admin</Button>
          </Link>
        }
      />

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Work tracking settings saved.
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-ink-500">Org avg efficiency (MTD)</div>
            <div className="text-3xl font-bold text-sky-600 mt-1">{avgEfficiency}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-ink-500">Flagged employees</div>
            <div className="text-3xl font-bold text-orange-600 mt-1">{flaggedTotal}</div>
            <div className="text-xs text-ink-400 mt-1">Below {config.pipEfficiencyThreshold}% efficiency</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-sm text-ink-500">EOD deadline</div>
            <div className="text-3xl font-bold text-ink-700 mt-1">{formatEodDeadline(config)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Department comparison</CardTitle>
          <CardDescription>Month-to-date efficiency and EOD submission compliance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 border-b border-ink-100">
                  <th className="pb-2 pr-4">Department</th>
                  <th className="pb-2 pr-4">Members</th>
                  <th className="pb-2 pr-4">Avg efficiency</th>
                  <th className="pb-2 pr-4">EOD compliance</th>
                  <th className="pb-2">Flagged</th>
                </tr>
              </thead>
              <tbody>
                {deptRows
                  .filter((d) => d.memberCount > 0)
                  .sort((a, b) => b.avgEfficiency - a.avgEfficiency)
                  .map((d) => (
                    <tr key={d.departmentId} className="border-b border-ink-50">
                      <td className="py-2 pr-4 font-medium text-ink-700">
                        {d.emoji} {d.departmentName}
                      </td>
                      <td className="py-2 pr-4">{d.memberCount}</td>
                      <td className="py-2 pr-4">
                        <Badge tone={d.avgEfficiency >= 75 ? "green" : d.avgEfficiency >= 50 ? "orange" : "red"}>
                          {d.avgEfficiency}%
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tone={d.eodCompliancePct >= config.minEodCompliancePct ? "green" : "red"}>
                          {d.eodCompliancePct}%
                        </Badge>
                      </td>
                      <td className="py-2">
                        {d.flaggedCount > 0 ? (
                          <Badge tone="orange">{d.flaggedCount} for review</Badge>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance linkage settings</CardTitle>
          <CardDescription>
            Monthly efficiency feeds appraisal. PIP triggers when efficiency stays below threshold for consecutive weeks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateWorkTrackingConfig} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="eodDeadlineHour">EOD deadline hour (24h)</Label>
              <Input id="eodDeadlineHour" name="eodDeadlineHour" type="number" min={0} max={23} defaultValue={config.eodDeadlineHour} />
            </div>
            <div>
              <Label htmlFor="eodDeadlineMinute">EOD deadline minute</Label>
              <Input id="eodDeadlineMinute" name="eodDeadlineMinute" type="number" min={0} max={59} defaultValue={config.eodDeadlineMinute} />
            </div>
            <div>
              <Label htmlFor="minEodCompliancePct">Min EOD compliance %</Label>
              <Input id="minEodCompliancePct" name="minEodCompliancePct" type="number" min={0} max={100} defaultValue={config.minEodCompliancePct} />
            </div>
            <div>
              <Label htmlFor="pipEfficiencyThreshold">PIP efficiency threshold %</Label>
              <Input id="pipEfficiencyThreshold" name="pipEfficiencyThreshold" type="number" min={0} max={100} defaultValue={config.pipEfficiencyThreshold} />
            </div>
            <div>
              <Label htmlFor="pipConsecutiveWeeks">PIP consecutive weeks</Label>
              <Input id="pipConsecutiveWeeks" name="pipConsecutiveWeeks" type="number" min={1} max={12} defaultValue={config.pipConsecutiveWeeks} />
            </div>
            <div className="flex items-end">
              <Button type="submit">Save settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
