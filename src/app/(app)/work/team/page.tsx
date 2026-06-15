import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { firstSearchParam } from "@/lib/search-param";
import { parseWorkDateParam, formatWorkDate, todayDateOnly } from "@/lib/work-tracking/dates";
import { canViewTeamWork, canAssignDailyTasks } from "@/lib/work-tracking/access";
import {
  loadTeamDailySnapshot,
  loadCarryForwardSuggestions,
  loadTeamTaskBoard,
  loadTeamDailyMetrics,
} from "@/lib/work-tracking/snapshots";
import { ensureDeptTaskTypes } from "@/lib/work-tracking/default-task-types";
import {
  currentOkrPeriod,
  formatOkrPeriodLabel,
  isCurrentPeriodObjective,
} from "@/lib/work-tracking/okr-progress";
import { assignDailyTask, carryForwardDailyTask } from "../actions";
import { DeptOkrsPanel } from "../_components/dept-okrs-panel";
import { QuantityUnitFields } from "../_components/quantity-unit-fields";
import { TeamTaskBoard } from "../_components/team-task-board";

export default function WorkTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; assignee?: string }>;
}) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <WorkTeamPageBody searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkTeamPageBody({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; assignee?: string }>;
}) {
  const me = await requireAppViewer();
  if (!me) return null;

  if (
    !canViewTeamWork({
      viewerRole: me.role,
      viewerPermissions: me.permissions,
      viewerUserId: me.id,
      viewerHeadedDepartmentId: me.headedDept?.id ?? null,
    })
  ) {
    redirect("/work");
  }

  const sp = await searchParams;
  const workDate = parseWorkDateParam(firstSearchParam(sp.date) ?? formatWorkDate(todayDateOnly()));
  const dateParam = formatWorkDate(workDate);
  const selectedAssignee = firstSearchParam(sp.assignee);

  let memberFilter: { departmentId?: string; managerId?: string } = {};
  const isGlobalViewer = ["CEO", "ADMIN", "HR"].includes(me.role);
  if (isGlobalViewer) {
    memberFilter = {};
  } else if (me.role === "DEPT_HEAD" && me.headedDept?.id) {
    memberFilter = { departmentId: me.headedDept.id };
  } else if (me.role === "MANAGER") {
    memberFilter = { managerId: me.id };
  }

  const members = await prisma.user.findMany({
    where: { status: "ACTIVE", ...memberFilter },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      departmentId: true,
      managerId: true,
      department: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const memberIds = members.map((m) => m.id);
  const deptIds = [...new Set(members.map((m) => m.departmentId).filter(Boolean))] as string[];

  for (const dept of members) {
    if (dept.department) await ensureDeptTaskTypes(dept.department.id, dept.department.slug);
  }

  const { year, month, quarter } = currentOkrPeriod();

  const [snapshot, taskBoard, metrics, taskTypes, keyResults, okrObjectives] = await Promise.all([
    loadTeamDailySnapshot({ memberIds, workDate }),
    loadTeamTaskBoard({ memberIds, workDate }),
    loadTeamDailyMetrics({ memberIds, workDate }),
    prisma.deptTaskType.findMany({
      where: { departmentId: { in: deptIds }, isActive: true },
      orderBy: [{ departmentId: "asc" }, { sortOrder: "asc" }],
      include: { department: { select: { name: true } } },
    }),
    prisma.deptOkrKeyResult.findMany({
      where: { objective: { departmentId: { in: deptIds }, status: { not: "ARCHIVED" } } },
      include: { objective: { select: { title: true, departmentId: true } }, taskType: { select: { name: true } } },
      orderBy: { title: "asc" },
    }),
    prisma.deptOkrObjective.findMany({
      where: { departmentId: { in: deptIds }, year, status: { not: "ARCHIVED" } },
      include: {
        keyResults: { include: { taskType: { select: { name: true } } } },
      },
      orderBy: [{ cycle: "asc" }, { quarter: "asc" }, { month: "asc" }],
    }),
  ]);

  const currentObjectives = okrObjectives.filter((obj) => isCurrentPeriodObjective(obj));
  const periodLabel = formatOkrPeriodLabel("MONTH", year, quarter, month);

  const assignee = selectedAssignee ? members.find((m) => m.id === selectedAssignee) : members[0];

  const carrySuggestions = assignee
    ? await loadCarryForwardSuggestions({ assigneeId: assignee.id, workDate })
    : [];

  const canAssign =
    assignee &&
    canAssignDailyTasks({
      viewerRole: me.role,
      viewerPermissions: me.permissions,
      viewerUserId: me.id,
      viewerHeadedDepartmentId: me.headedDept?.id ?? null,
      assigneeManagerId: assignee.managerId,
      assigneeDepartmentId: assignee.departmentId,
    });

  const assigneeTaskTypes = taskTypes.filter((t) => t.departmentId === assignee?.departmentId);
  const assigneeKrs = keyResults.filter((kr) => kr.objective.departmentId === assignee?.departmentId);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const taskBoardRows = taskBoard.map((row) => {
    const member = memberById.get(row.userId);
    const canManage =
      !!member &&
      canAssignDailyTasks({
        viewerRole: me.role,
        viewerPermissions: me.permissions,
        viewerUserId: me.id,
        viewerHeadedDepartmentId: me.headedDept?.id ?? null,
        assigneeManagerId: member.managerId,
        assigneeDepartmentId: member.departmentId,
      }) &&
      row.eodStatus === null;
    return { ...row, canManage };
  });

  const boardTaskTypes = taskTypes.map((t) => ({
    id: t.id,
    name: t.name,
    departmentId: t.departmentId,
  }));
  const boardKeyResults = keyResults.map((kr) => ({
    id: kr.id,
    title: kr.title,
    departmentId: kr.objective.departmentId,
    taskTypeName: kr.taskType?.name ?? null,
  }));

  const primaryDept = me.headedDept ?? me.department;
  const deptObjectivesForPanel = primaryDept
    ? currentObjectives.filter((o) => o.departmentId === primaryDept.id)
    : currentObjectives;

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-500">
        Assign daily tasks, track delivered vs assigned, and align with department OKRs.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <form method="get" className="flex items-end gap-2">
          {selectedAssignee && <input type="hidden" name="assignee" value={selectedAssignee} />}
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" defaultValue={dateParam} className="w-auto" />
          </div>
          <Button type="submit" variant="outline" size="sm">Go</Button>
        </form>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Today's tasks" value={String(metrics.totalTasks)} sub="Assigned to team" />
        <MetricCard
          label="Quantity delivered"
          value={`${metrics.deliveredQuantity}/${metrics.assignedQuantity}`}
          sub={`${metrics.quantityCompletionPct}% of target`}
        />
        <MetricCard
          label="EOD submitted"
          value={`${metrics.eodSubmitted} / ${metrics.eodExpected}`}
          sub={metrics.eodExpected > metrics.eodSubmitted ? "Pending submissions" : "All submitted"}
        />
        <MetricCard
          label="Period OKRs"
          value={deptObjectivesForPanel.length > 0 ? `${deptObjectivesForPanel.length} active` : "—"}
          sub={periodLabel}
        />
      </div>

      {deptObjectivesForPanel.length > 0 && primaryDept && (
        <DeptOkrsPanel
          departmentName={primaryDept.name}
          periodLabel={periodLabel}
          objectives={deptObjectivesForPanel}
          variant="current"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task board — {dateParam}</CardTitle>
        </CardHeader>
        <CardContent>
          <TeamTaskBoard rows={taskBoardRows} taskTypes={boardTaskTypes} keyResults={boardKeyResults} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team status — {dateParam}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-500 border-b border-ink-100">
                  <th className="pb-2 pr-4">Member</th>
                  <th className="pb-2 pr-4">Tasks</th>
                  <th className="pb-2 pr-4">Delivered / Assigned</th>
                  <th className="pb-2 pr-4">Efficiency</th>
                  <th className="pb-2">EOD</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.map((row) => (
                  <tr key={row.userId} className="border-b border-ink-50">
                    <td className="py-2 pr-4 font-medium text-ink-700">
                      <Link href={`/work/team?date=${dateParam}&assignee=${row.userId}`} className="hover:text-sky-600">
                        {row.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{row.assignedCount}</td>
                    <td className="py-2 pr-4">
                      {row.deliveredQuantity} / {row.assignedQuantity}
                    </td>
                    <td className="py-2 pr-4">{row.efficiencyPct}%</td>
                    <td className="py-2">
                      <EodBadge status={row.eodStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {assignee && carrySuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Carry-forward suggestions for {assignee.firstName || assignee.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {carrySuggestions.map((s) => (
              <div
                key={s.sourceTaskId}
                className="flex flex-wrap items-center justify-between gap-3 text-sm border-b border-ink-50 pb-3 last:border-0 last:pb-0"
              >
                <div className="text-ink-600">
                  <strong>{s.taskName}</strong> — {s.remainingQuantity} {s.quantityUnit} remaining
                  <span className="text-ink-400">
                    {" "}
                    (was {s.actualQuantity}/{s.originalTarget} on {s.sourceDate})
                  </span>
                </div>
                {canAssign && (
                  <form action={carryForwardDailyTask}>
                    <input type="hidden" name="sourceTaskId" value={s.sourceTaskId} />
                    <input type="hidden" name="workDate" value={dateParam} />
                    <Button type="submit" size="sm" variant="outline">
                      Add to today
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {assignee && canAssign && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assign task to {assignee.firstName || assignee.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={assignDailyTask} className="grid sm:grid-cols-2 gap-4">
              <input type="hidden" name="assigneeId" value={assignee.id} />
              <input type="hidden" name="workDate" value={dateParam} />
              <div className="sm:col-span-2">
                <Label htmlFor="projectName">Task name</Label>
                <Input id="projectName" name="projectName" required placeholder="e.g. Client interviews" />
              </div>
              <div>
                <Label htmlFor="targetQuantity">Target quantity</Label>
                <Input id="targetQuantity" name="targetQuantity" type="number" min={0.01} step="0.01" defaultValue={1} required />
              </div>
              <QuantityUnitFields />
              <div>
                <Label htmlFor="taskTypeId">Task type (optional)</Label>
                <Select id="taskTypeId" name="taskTypeId">
                  <option value="">— General —</option>
                  {assigneeTaskTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>{tt.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select id="priority" name="priority" defaultValue="P2">
                  <option value="P1">P1 — Urgent</option>
                  <option value="P2">P2 — Normal</option>
                  <option value="P3">P3 — Low</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="dueByTime">Due by (time)</Label>
                <Input id="dueByTime" name="dueByTime" type="time" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="keyResultId">Linked key result (optional)</Label>
                <Select id="keyResultId" name="keyResultId">
                  <option value="">— None —</option>
                  {assigneeKrs.map((kr) => (
                    <option key={kr.id} value={kr.id}>
                      {kr.title} ({kr.taskType?.name ?? "any"})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Assign task</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {members.map((m) => (
          <Link key={m.id} href={`/work/team?date=${dateParam}&assignee=${m.id}`}>
            <Badge tone={m.id === assignee?.id ? "sky" : "ink"}>
              {m.firstName || m.name}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
        <div className="text-2xl font-semibold text-ink-800 mt-1">{value}</div>
        <div className="text-xs text-ink-500 mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}

function EodBadge({ status }: { status: string }) {
  const tone: Record<string, "green" | "orange" | "red" | "ink"> = {
    SUBMITTED: "green",
    DRAFT: "orange",
    MISSING: "red",
    NONE: "ink",
  };
  return <Badge tone={tone[status] ?? "ink"}>{status}</Badge>;
}
