"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { TeamTaskBoardRow } from "@/lib/work-tracking/snapshots";
import type { CarryForwardSuggestion } from "@/lib/work-tracking/snapshots";
import { assignDailyTask, carryForwardDailyTask } from "../actions";
import { QuantityUnitFields } from "./quantity-unit-fields";
import { TeamTaskBoard } from "./team-task-board";

type Member = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
};

type TaskTypeOption = { id: string; name: string; departmentId: string };
type KrOption = { id: string; title: string; taskType?: { name: string | null } | null };

function memberLabel(m: Member): string {
  return [m.firstName, m.lastName].filter(Boolean).join(" ") || m.name || "Unknown";
}

function AssigneeSelect({
  members,
  assigneeId,
  dateParam,
  deptParam,
}: {
  members: Member[];
  assigneeId: string | undefined;
  dateParam: string;
  deptParam: string | undefined;
}) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams({ date: dateParam, assignee: e.target.value });
    if (deptParam) params.set("dept", deptParam);
    router.push(`/work/team?${params.toString()}`);
  }

  return (
    <div className="max-w-xs">
      <Label htmlFor="assignee-select">Assign to</Label>
      <Select id="assignee-select" value={assigneeId ?? ""} onChange={onChange}>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {memberLabel(m)}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function TeamAssignSection({
  dateParam,
  deptParam,
  members,
  assignee,
  canAssign,
  carrySuggestions,
  assigneeTaskTypes,
  assigneeKrs,
  taskBoardRows,
  boardTaskTypes,
  boardKeyResults,
}: {
  dateParam: string;
  deptParam: string | undefined;
  members: Member[];
  assignee: Member | undefined;
  canAssign: boolean;
  carrySuggestions: CarryForwardSuggestion[];
  assigneeTaskTypes: TaskTypeOption[];
  assigneeKrs: KrOption[];
  taskBoardRows: TeamTaskBoardRow[];
  boardTaskTypes: TaskTypeOption[];
  boardKeyResults: { id: string; title: string; departmentId: string; taskTypeName: string | null }[];
}) {
  const assigneeName = assignee ? memberLabel(assignee) : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Assign tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {members.length > 0 && (
          <AssigneeSelect
            members={members}
            assigneeId={assignee?.id}
            dateParam={dateParam}
            deptParam={deptParam}
          />
        )}

        {assignee && canAssign && (
          <form action={assignDailyTask} className="grid sm:grid-cols-2 gap-4 border-t border-ink-100 pt-6">
            <input type="hidden" name="assigneeId" value={assignee.id} />
            <input type="hidden" name="workDate" value={dateParam} />
            <div className="sm:col-span-2">
              <Label htmlFor="projectName">Task name</Label>
              <Input id="projectName" name="projectName" required placeholder="e.g. Client interviews" />
            </div>
            <div>
              <Label htmlFor="targetQuantity">Target quantity</Label>
              <Input
                id="targetQuantity"
                name="targetQuantity"
                type="number"
                min={0.01}
                step="0.01"
                defaultValue={1}
                required
              />
            </div>
            <QuantityUnitFields />
            <div>
              <Label htmlFor="taskTypeId">Task type (optional)</Label>
              <Select id="taskTypeId" name="taskTypeId">
                <option value="">— General —</option>
                {assigneeTaskTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name}
                  </option>
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
        )}

        {assignee && carrySuggestions.length > 0 && (
          <div className="space-y-3 border-t border-ink-100 pt-6">
            <h4 className="text-sm font-medium text-ink-700">
              Carry-forward suggestions for {assigneeName}
            </h4>
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
          </div>
        )}

        <div className="border-t border-ink-100 pt-6">
          <h4 className="text-sm font-medium text-ink-700 mb-3">Task board — {dateParam}</h4>
          <TeamTaskBoard rows={taskBoardRows} taskTypes={boardTaskTypes} keyResults={boardKeyResults} />
        </div>
      </CardContent>
    </Card>
  );
}
