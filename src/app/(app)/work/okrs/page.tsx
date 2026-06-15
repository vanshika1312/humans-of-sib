import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { canManageDeptOkrs } from "@/lib/work-tracking/access";
import { ensureDeptTaskTypes } from "@/lib/work-tracking/default-task-types";
import {
  currentOkrPeriod,
  formatOkrPeriodLabel,
  isCurrentPeriodObjective,
} from "@/lib/work-tracking/okr-progress";
import { DeptOkrsPanel } from "../_components/dept-okrs-panel";
import { createDeptOkrObjective, createDeptTaskType } from "../actions";

export default function WorkOkrsPage() {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <WorkOkrsPageBody />
    </Suspense>
  );
}

async function WorkOkrsPageBody() {
  const me = await requireAppViewer();
  if (!me) return null;

  const departmentId = me.departmentId;
  if (!departmentId || !me.department) {
    return (
      <Card><CardContent className="py-12 text-center text-ink-500">You are not assigned to a department.</CardContent></Card>
    );
  }

  await ensureDeptTaskTypes(departmentId, me.department.slug);

  const { year, month, quarter } = currentOkrPeriod();

  const canManage = canManageDeptOkrs({
    viewerRole: me.role,
    viewerHeadedDepartmentId: me.headedDept?.id ?? null,
    departmentId,
  });

  const [objectives, taskTypes] = await Promise.all([
    prisma.deptOkrObjective.findMany({
      where: { departmentId, year, status: { not: "ARCHIVED" } },
      include: {
        keyResults: { include: { taskType: { select: { name: true } } } },
        createdBy: { select: { firstName: true, lastName: true, name: true } },
      },
      orderBy: [{ cycle: "asc" }, { quarter: "asc" }, { month: "asc" }],
    }),
    prisma.deptTaskType.findMany({
      where: { departmentId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const currentObjectives = objectives.filter((obj) => isCurrentPeriodObjective(obj));
  const otherObjectives = objectives.filter((obj) => !isCurrentPeriodObjective(obj));
  const periodLabel = formatOkrPeriodLabel("MONTH", year, quarter, month);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink-700">
          {me.department.emoji ?? "🎯"} {me.department.name} OKRs
        </h2>
        <p className="text-sm text-ink-500 mt-1">
          Set monthly/quarterly targets. Daily tasks on Team view roll up here.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr,360px] gap-6">
        <div className="space-y-4">
          {objectives.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-ink-500">
                No department OKRs for {year} yet.
                {canManage ? " Create one using the form." : " Your HOD will set these."}
              </CardContent>
            </Card>
          ) : (
            <>
              {currentObjectives.length > 0 ? (
                <DeptOkrsPanel
                  departmentName={me.department.name}
                  periodLabel={periodLabel}
                  objectives={currentObjectives}
                  canManage={canManage}
                  taskTypes={taskTypes}
                />
              ) : (
                <Card>
                  <CardContent className="py-10 text-center text-ink-500">
                    No OKRs set for {periodLabel} yet.
                    {canManage ? " Create a monthly or quarterly objective." : " Your HOD will set these."}
                  </CardContent>
                </Card>
              )}

              {otherObjectives.length > 0 && (
                <DeptOkrsPanel
                  departmentName={me.department.name}
                  periodLabel={`${year}`}
                  objectives={otherObjectives}
                  variant="archive"
                />
              )}
            </>
          )}
        </div>

        {canManage && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New objective</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createDeptOkrObjective} className="space-y-3">
                  <input type="hidden" name="departmentId" value={departmentId} />
                  <div>
                    <Label htmlFor="cycle">Cycle</Label>
                    <Select id="cycle" name="cycle" defaultValue="MONTH">
                      <option value="QUARTER">Quarter</option>
                      <option value="MONTH">Month</option>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="year">Year</Label>
                      <Input id="year" name="year" type="number" defaultValue={year} required />
                    </div>
                    <div>
                      <Label htmlFor="quarter">Quarter</Label>
                      <Select id="quarter" name="quarter" defaultValue={String(quarter)}>
                        <option value="1">Q1</option>
                        <option value="2">Q2</option>
                        <option value="3">Q3</option>
                        <option value="4">Q4</option>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="month">Month</Label>
                      <Select id="month" name="month" defaultValue={String(month)}>
                        {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                          <option key={m} value={i + 1}>{m}</option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="title">Objective</Label>
                    <Input id="title" name="title" required placeholder="Deliver content on schedule" />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" rows={2} />
                  </div>
                  <Button type="submit" className="w-full">Create objective</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Task type library</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {taskTypes.map((tt) => (
                    <Badge key={tt.id} tone="ink">{tt.name} · {tt.complexity}</Badge>
                  ))}
                </div>
                <form action={createDeptTaskType} className="space-y-3 border-t border-ink-100 pt-3">
                  <input type="hidden" name="departmentId" value={departmentId} />
                  <div>
                    <Label htmlFor="tt-name">New task type</Label>
                    <Input id="tt-name" name="name" required placeholder="e.g. Short-form" />
                  </div>
                  <div>
                    <Label htmlFor="tt-complexity">Complexity</Label>
                    <Select id="tt-complexity" name="complexity" defaultValue="MEDIUM">
                      <option value="SIMPLE">Simple</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="COMPLEX">Complex</option>
                    </Select>
                  </div>
                  <Button type="submit" size="sm" variant="outline">Add type</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
