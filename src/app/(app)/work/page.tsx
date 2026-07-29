import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { firstSearchParam } from "@/lib/search-param";
import { parseWorkDateParam, formatWorkDate } from "@/lib/work-tracking/dates";
import {
  getWorkTrackingConfig,
  isPastEodDeadline,
  formatQuantityLabel,
  formatEodDeadline,
} from "@/lib/work-tracking/config";
import { loadEfficiencyTrend, loadWeeklyRollup } from "@/lib/work-tracking/snapshots";
import { EfficiencyTrendChart } from "./_components/efficiency-trend-chart";
import { TodayTasksList } from "./_components/today-tasks-list";
import { EodSubmitForm } from "./_components/eod-submit-form";

export default function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string; task?: string; edit?: string }>;
}) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <WorkPageBody searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkPageBody({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tab?: string; task?: string; edit?: string }>;
}) {
  const me = await requireAppViewer();
  if (!me) return null;

  const sp = await searchParams;
  const workDate = parseWorkDateParam(firstSearchParam(sp.date));
  const tab = firstSearchParam(sp.tab) ?? "today";
  const openTaskId = firstSearchParam(sp.task);
  const eodEditMode = firstSearchParam(sp.edit) === "1";
  const dateParam = formatWorkDate(workDate);

  const [tasks, submission, config, trend, weeklyPct] = await Promise.all([
    prisma.dailyWorkTask.findMany({
      where: { assigneeId: me.id, workDate },
      include: {
        taskType: true,
        keyResult: { select: { title: true } },
        assignedBy: { select: { firstName: true, lastName: true, name: true } },
        attachments: { select: { id: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.dailyEodSubmission.findUnique({
      where: { userId_workDate: { userId: me.id, workDate } },
      include: { entries: true },
    }),
    getWorkTrackingConfig(),
    loadEfficiencyTrend(me.id, 14),
    loadWeeklyRollup(me.id),
  ]);

  const eodSubmitted = submission?.status === "SUBMITTED";
  const hasUnreportedTasks = tasks.some((t) => t.eodStatus === null);
  const pastDeadline = isPastEodDeadline(workDate, config);
  const canAmendEod = hasUnreportedTasks || !pastDeadline;
  const showEodForm = !eodSubmitted || canAmendEod || eodEditMode;
  const eodFullySubmitted = eodSubmitted && !hasUnreportedTasks;
  const eodManualEdit = eodEditMode && eodFullySubmitted;
  const eodMissing = tasks.length > 0 && !eodFullySubmitted && pastDeadline;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">
        Assigned tasks &amp; EOD by {formatEodDeadline(config)}. Efficiency is based on delivered vs assigned quantity.
      </p>

      <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-1">
        <TabLink href={`/work?date=${dateParam}&tab=today`} active={tab === "today"}>Today&apos;s tasks</TabLink>
        <TabLink href={`/work?date=${dateParam}&tab=eod`} active={tab === "eod"}>EOD report</TabLink>
        <TabLink href="/work?tab=efficiency" active={tab === "efficiency"}>My efficiency</TabLink>
      </div>

      {tab === "today" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form method="get" className="flex items-end gap-2">
              <input type="hidden" name="tab" value="today" />
              <div>
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" defaultValue={dateParam} className="w-auto" />
              </div>
              <Button type="submit" variant="outline" size="sm">Go</Button>
            </form>
            {eodFullySubmitted && <Badge tone="green">EOD submitted</Badge>}
            {hasUnreportedTasks && eodSubmitted && (
              <Badge tone="orange">EOD needs update</Badge>
            )}
            {eodMissing && <Badge tone="red">EOD missing</Badge>}
          </div>

          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-ink-500">
                No tasks assigned for this day. Check back after your manager&apos;s morning assignment.
              </CardContent>
            </Card>
          ) : (
            <TodayTasksList
              dateParam={dateParam}
              initialOpenTaskId={openTaskId ?? null}
              tasks={tasks.map((t) => ({
                id: t.id,
                projectName: t.projectName,
                priority: t.priority,
                taskTypeName: t.taskType.name,
                eodStatus: t.eodStatus,
                targetQuantity: Number(t.targetQuantity),
                quantityUnit: t.quantityUnit,
                dueByTime: t.dueByTime,
                keyResultTitle: t.keyResult?.title ?? null,
                actualQuantity: t.actualQuantity != null ? Number(t.actualQuantity) : null,
                attachmentCount: t.attachments.length,
              }))}
            />
          )}
        </div>
      )}

      {tab === "eod" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form method="get" className="flex items-end gap-2">
              <input type="hidden" name="tab" value="eod" />
              <div>
                <Label htmlFor="eod-date">Date</Label>
                <Input id="eod-date" name="date" type="date" defaultValue={dateParam} className="w-auto" />
              </div>
              <Button type="submit" variant="outline" size="sm">Go</Button>
            </form>
            {eodFullySubmitted && <Badge tone="green">EOD submitted</Badge>}
            {hasUnreportedTasks && eodSubmitted && (
              <Badge tone="orange">EOD needs update</Badge>
            )}
            {eodMissing && <Badge tone="red">EOD missing</Badge>}
          </div>
          {eodMissing && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              EOD was not submitted by the {formatEodDeadline(config)} deadline and is flagged as missing.
            </div>
          )}
          {tasks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-ink-500">No tasks to report on for {dateParam}.</CardContent>
            </Card>
          ) : showEodForm ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {eodManualEdit ? "Edit EOD" : eodSubmitted ? "Update EOD" : "Submit EOD"} — {dateParam}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EodSubmitForm
                  workDate={dateParam}
                  isAmendment={eodSubmitted}
                  isManualEdit={eodManualEdit}
                  cancelHref={eodManualEdit ? `/work?date=${dateParam}&tab=eod` : undefined}
                  tasks={tasks.map((t) => ({
                    id: t.id,
                    projectName: t.projectName,
                    taskTypeName: t.taskType.name,
                    keyResultTitle: t.keyResult?.title ?? null,
                    targetQuantity: Number(t.targetQuantity),
                    quantityUnit: t.quantityUnit,
                    defaultActual: Number(t.actualQuantity ?? 0),
                    defaultStatus: t.eodStatus,
                    blockerReason: t.blockerReason,
                    carryForward: t.carryForward,
                  }))}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="text-base">Submitted EOD — {dateParam}</CardTitle>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/work?date=${dateParam}&tab=eod&edit=1`}>Edit EOD</Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4 text-sm">
                  <span>Efficiency: <strong>{submission?.efficiencyPct ?? 0}%</strong></span>
                  {submission?.weightedScore != null && submission.weightedScore !== submission.efficiencyPct && (
                    <span>Weighted: <strong>{submission.weightedScore}%</strong></span>
                  )}
                </div>
                {tasks.map((t) => (
                  <div key={t.id} className="border-t border-ink-100 pt-3">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge tone="sky">{t.taskType.name}</Badge>
                      {t.keyResult && (
                        <span className="text-xs text-ink-500">KR: {t.keyResult.title}</span>
                      )}
                    </div>
                    <div className="font-medium text-ink-700">{t.projectName}</div>
                    <div className="text-sm text-ink-500">
                      {t.eodStatus?.replace("_", " ")} —{" "}
                      {formatQuantityLabel(Number(t.actualQuantity ?? 0), t.quantityUnit)} /{" "}
                      {formatQuantityLabel(Number(t.targetQuantity), t.quantityUnit)}
                      {t.blockerReason ? ` · ${t.blockerReason}` : ""}
                      {t.carryForward ? " · Carry forward" : ""}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "efficiency" && (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="text-sm text-ink-500">This week (qty-based)</div>
                <div className="text-3xl font-bold text-sky-600 mt-1">{weeklyPct}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-sm text-ink-500">EOD compliance threshold</div>
                <div className="text-3xl font-bold text-ink-700 mt-1">{config.minEodCompliancePct}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-sm text-ink-500">PIP flag if below</div>
                <div className="text-3xl font-bold text-orange-600 mt-1">{config.pipEfficiencyThreshold}%</div>
                <div className="text-xs text-ink-400 mt-1">for {config.pipConsecutiveWeeks} consecutive weeks</div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">14-day efficiency trend (delivered / assigned)</CardTitle>
            </CardHeader>
            <CardContent>
              <EfficiencyTrendChart data={trend} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px ${
        active ? "border-sky-500 text-sky-700" : "border-transparent text-ink-500 hover:text-ink-700"
      }`}
    >
      {children}
    </Link>
  );
}
