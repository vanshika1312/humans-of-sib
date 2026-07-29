import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { firstSearchParam } from "@/lib/search-param";
import { parseWorkDateParam, formatWorkDate, todayDateOnly } from "@/lib/work-tracking/dates";
import { canViewTeamWork, canAssignDailyTasks, getTeamMemberVisibilityScope, teamMemberPrismaFilter } from "@/lib/work-tracking/access";
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
import { DeptOkrsPanel } from "../_components/dept-okrs-panel";
import { TeamAssignSection } from "../_components/team-assign-section";
import { TeamMembersSection } from "../_components/team-members-section";

export default function WorkTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; assignee?: string; dept?: string }>;
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
  searchParams: Promise<{ date?: string; assignee?: string; dept?: string }>;
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
  const selectedDept = firstSearchParam(sp.dept);

  const visibilityScope = getTeamMemberVisibilityScope({
    viewerRole: me.role,
    viewerUserId: me.id,
    viewerHeadedDepartmentId: me.headedDept?.id ?? null,
  });
  const memberFilter = teamMemberPrismaFilter(visibilityScope);

  const allMembers = await prisma.user.findMany({
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

  const departments = [
    ...new Map(
      allMembers
        .filter((m) => m.department)
        .map((m) => [m.department!.id, { id: m.department!.id, name: m.department!.name }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const showDeptFilter = departments.length > 1;
  const showDeptColumn = departments.length > 1;

  const filteredMembers = selectedDept
    ? allMembers.filter((m) => m.departmentId === selectedDept)
    : allMembers;

  const memberIds = filteredMembers.map((m) => m.id);
  const allDeptIds = [...new Set(allMembers.map((m) => m.departmentId).filter(Boolean))] as string[];

  for (const member of allMembers) {
    if (member.department) await ensureDeptTaskTypes(member.department.id, member.department.slug);
  }

  const { year, month, quarter } = currentOkrPeriod();

  const [snapshot, taskBoard, metrics, taskTypes, keyResults, okrObjectives] = await Promise.all([
    loadTeamDailySnapshot({ memberIds, workDate }),
    loadTeamTaskBoard({ memberIds, workDate }),
    loadTeamDailyMetrics({ memberIds, workDate }),
    prisma.deptTaskType.findMany({
      where: { departmentId: { in: allDeptIds }, isActive: true },
      orderBy: [{ departmentId: "asc" }, { sortOrder: "asc" }],
      include: { department: { select: { name: true } } },
    }),
    prisma.deptOkrKeyResult.findMany({
      where: { objective: { departmentId: { in: allDeptIds }, status: { not: "ARCHIVED" } } },
      include: { objective: { select: { title: true, departmentId: true } }, taskType: { select: { name: true } } },
      orderBy: { title: "asc" },
    }),
    prisma.deptOkrObjective.findMany({
      where: { departmentId: { in: allDeptIds }, year, status: { not: "ARCHIVED" } },
      include: {
        keyResults: { include: { taskType: { select: { name: true } } } },
      },
      orderBy: [{ cycle: "asc" }, { quarter: "asc" }, { month: "asc" }],
    }),
  ]);

  const currentObjectives = okrObjectives.filter((obj) => isCurrentPeriodObjective(obj));
  const periodLabel = formatOkrPeriodLabel("MONTH", year, quarter, month);

  const assignee = selectedAssignee
    ? allMembers.find((m) => m.id === selectedAssignee)
    : allMembers[0];

  const carrySuggestions = assignee
    ? await loadCarryForwardSuggestions({ assigneeId: assignee.id, workDate })
    : [];

  const canAssign = Boolean(
    assignee &&
      canAssignDailyTasks({
        viewerRole: me.role,
        viewerPermissions: me.permissions,
        viewerUserId: me.id,
        viewerHeadedDepartmentId: me.headedDept?.id ?? null,
        assigneeManagerId: assignee.managerId,
        assigneeDepartmentId: assignee.departmentId,
      }),
  );

  const assigneeTaskTypes = taskTypes.filter((t) => t.departmentId === assignee?.departmentId);
  const assigneeKrs = keyResults.filter((kr) => kr.objective.departmentId === assignee?.departmentId);

  const memberById = new Map(allMembers.map((m) => [m.id, m]));
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
          {selectedDept && <input type="hidden" name="dept" value={selectedDept} />}
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" defaultValue={dateParam} className="w-auto" />
          </div>
          <Button type="submit" variant="outline" size="sm">
            Go
          </Button>
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

      <TeamAssignSection
        dateParam={dateParam}
        deptParam={selectedDept}
        members={allMembers}
        assignee={assignee}
        canAssign={canAssign}
        carrySuggestions={carrySuggestions}
        assigneeTaskTypes={assigneeTaskTypes}
        assigneeKrs={assigneeKrs}
        taskBoardRows={taskBoardRows}
        boardTaskTypes={boardTaskTypes}
        boardKeyResults={boardKeyResults}
      />

      <TeamMembersSection
        viewerId={me.id}
        dateParam={dateParam}
        deptParam={selectedDept}
        assigneeParam={selectedAssignee}
        departments={departments}
        showDeptFilter={showDeptFilter}
        showDeptColumn={showDeptColumn}
        snapshot={snapshot}
      />
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
