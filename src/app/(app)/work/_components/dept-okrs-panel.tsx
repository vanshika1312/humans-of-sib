import type { DeptOkrMetricUnit } from "@/generated/prisma";
import { BookOpen, Play, Star, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  calcKrProgressPct,
  formatKrProgressLabel,
  formatOkrPeriodLabel,
  krProgressBarColor,
} from "@/lib/work-tracking/okr-progress";
import { createDeptKeyResult } from "../actions";

const OBJECTIVE_ICONS: LucideIcon[] = [Play, BookOpen, Star, Target, TrendingUp];

export type DeptOkrObjectiveView = {
  id: string;
  title: string;
  description: string | null;
  cycle: string;
  year: number;
  quarter: number | null;
  month: number | null;
  status: string;
  keyResults: Array<{
    id: string;
    title: string;
    currentValue: { toString(): string };
    targetValue: { toString(): string };
    unit: DeptOkrMetricUnit;
    unitLabel: string | null;
    taskType: { name: string } | null;
  }>;
};

type TaskTypeOption = { id: string; name: string };

export function DeptOkrsPanel({
  departmentName,
  periodLabel,
  objectives,
  canManage,
  taskTypes,
  variant = "current",
}: {
  departmentName: string;
  periodLabel: string;
  objectives: DeptOkrObjectiveView[];
  canManage?: boolean;
  taskTypes?: TaskTypeOption[];
  variant?: "current" | "archive";
}) {
  const title =
    variant === "current"
      ? `Monthly OKRs — ${departmentName}`
      : `Other OKR periods — ${departmentName}`;

  if (objectives.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-sm font-medium text-ink-700">{title}</CardTitle>
        <span className="text-[11px] text-ink-400 shrink-0">{periodLabel}</span>
      </CardHeader>
      <CardContent className="space-y-4">
        {objectives.map((obj, objIndex) => {
          const Icon = OBJECTIVE_ICONS[objIndex % OBJECTIVE_ICONS.length];
          return (
            <div key={obj.id} className="last:mb-0">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span>{obj.title}</span>
                {variant === "archive" && (
                  <Badge tone="ink" className="ml-auto normal-case tracking-normal">
                    {formatOkrPeriodLabel(obj.cycle, obj.year, obj.quarter, obj.month)}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                {obj.keyResults.length === 0 ? (
                  <p className="text-xs text-ink-400 pl-5">No key results yet.</p>
                ) : (
                  obj.keyResults.map((kr) => {
                    const current = Number(kr.currentValue);
                    const target = Number(kr.targetValue);
                    const pct = calcKrProgressPct(current, target);
                    return (
                      <div key={kr.id}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[13px] text-ink-700">
                          <span>{kr.title}</span>
                          <span className="shrink-0 text-[11px] text-ink-400">
                            {formatKrProgressLabel(current, target, kr.unit, kr.unitLabel)}
                          </span>
                        </div>
                        <div className="h-[5px] overflow-hidden rounded bg-ink-100">
                          <div
                            className={`h-full rounded ${krProgressBarColor(pct)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {canManage && taskTypes && (
                <details className="mt-3 pl-5">
                  <summary className="cursor-pointer text-xs text-sky-600">Add key result</summary>
                  <form action={createDeptKeyResult} className="mt-3 space-y-3 border-t border-ink-100 pt-3">
                    <input type="hidden" name="objectiveId" value={obj.id} />
                    <div>
                      <Label htmlFor={`kr-title-${obj.id}`}>KR title</Label>
                      <Input id={`kr-title-${obj.id}`} name="title" required placeholder="Complete 20 reels this month" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor={`kr-target-${obj.id}`}>Target</Label>
                        <Input id={`kr-target-${obj.id}`} name="targetValue" type="number" min={0.01} step="0.01" required />
                      </div>
                    <div>
                      <Label htmlFor={`kr-unit-${obj.id}`}>Unit type</Label>
                      <Select id={`kr-unit-${obj.id}`} name="unit" defaultValue="COUNT">
                        <option value="COUNT">Count</option>
                        <option value="PERCENT">Percent</option>
                        <option value="CURRENCY">Currency (₹)</option>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor={`kr-unit-label-${obj.id}`}>Unit label (e.g. reels, interviews)</Label>
                      <Input id={`kr-unit-label-${obj.id}`} name="unitLabel" placeholder="interviews" />
                    </div>
                    </div>
                    <div>
                      <Label htmlFor={`kr-type-${obj.id}`}>Linked task type</Label>
                      <Select id={`kr-type-${obj.id}`} name="taskTypeId">
                        <option value="">— Any —</option>
                        {taskTypes.map((tt) => (
                          <option key={tt.id} value={tt.id}>{tt.name}</option>
                        ))}
                      </Select>
                    </div>
                    <Button type="submit" size="sm">Add KR</Button>
                  </form>
                </details>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
