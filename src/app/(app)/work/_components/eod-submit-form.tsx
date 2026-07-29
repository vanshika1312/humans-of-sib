"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatQuantityLabel } from "@/lib/work-tracking/config";
import { suggestEodStatus } from "@/lib/work-tracking/efficiency";
import type { DailyTaskEodStatus } from "@/generated/prisma";
import { submitEod } from "../actions";
import { EodQuantityField } from "./eod-quantity-field";
import { EodDaySummary, toQuantityInputs, type EodTaskValues } from "./eod-day-summary";

export type EodSubmitTask = {
  id: string;
  projectName: string;
  taskTypeName: string;
  keyResultTitle: string | null;
  targetQuantity: number;
  quantityUnit: string;
  defaultActual: number;
  defaultStatus: string | null;
  blockerReason: string | null;
  carryForward: boolean;
};

export function EodSubmitForm({
  workDate,
  tasks,
  isAmendment,
  isManualEdit,
  cancelHref,
}: {
  workDate: string;
  tasks: EodSubmitTask[];
  isAmendment?: boolean;
  isManualEdit?: boolean;
  cancelHref?: string;
}) {
  const initialValues: EodTaskValues[] = tasks.map((t) => {
    const actual = t.defaultActual;
    const status = (t.defaultStatus ??
      suggestEodStatus(t.targetQuantity, actual)) as DailyTaskEodStatus;
    return {
      taskId: t.id,
      targetQuantity: t.targetQuantity,
      actual,
      status,
    };
  });

  const [taskValues, setTaskValues] = useState<EodTaskValues[]>(initialValues);

  const quantityInputs = useMemo(() => toQuantityInputs(taskValues), [taskValues]);

  function updateTask(taskId: string, patch: Partial<Pick<EodTaskValues, "actual" | "status">>) {
    setTaskValues((prev) =>
      prev.map((v) => (v.taskId === taskId ? { ...v, ...patch } : v)),
    );
  }

  const submitLabel =
    tasks.length > 1
      ? isManualEdit
        ? `Save changes (${tasks.length} tasks)`
        : isAmendment
          ? `Update EOD (${tasks.length} tasks)`
          : `Submit EOD (${tasks.length} tasks)`
      : isManualEdit
        ? "Save changes"
        : isAmendment
          ? "Update EOD"
          : "Submit EOD";

  return (
    <form action={submitEod} className="space-y-6">
      <input type="hidden" name="workDate" value={workDate} />
      {isManualEdit && (
        <p className="text-sm text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
          You are editing a submitted EOD. Saving will update your reported quantities and efficiency score.
        </p>
      )}
      {isAmendment && !isManualEdit && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          New tasks were added or the deadline has not passed — update your EOD to include all assigned tasks.
        </p>
      )}
      {tasks.map((t) => (
        <div key={t.id} className="rounded-lg border border-ink-100 p-4 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge tone="sky">{t.taskTypeName}</Badge>
              {t.keyResultTitle && (
                <span className="text-xs text-ink-500">KR: {t.keyResultTitle}</span>
              )}
            </div>
            <div className="font-medium text-ink-700">
              {t.projectName}
              <span className="text-ink-400 font-normal">
                {" "}
                — target {formatQuantityLabel(t.targetQuantity, t.quantityUnit)}
              </span>
            </div>
          </div>
          <EodQuantityField
            taskId={t.id}
            targetQuantity={t.targetQuantity}
            quantityUnit={t.quantityUnit}
            defaultActual={t.defaultActual}
            defaultStatus={t.defaultStatus}
            defaultCarryForward={t.carryForward}
            onValuesChange={(actual, status) =>
              updateTask(t.id, { actual, status: status as DailyTaskEodStatus })
            }
          />
          <div>
            <Label htmlFor={`blocker-${t.id}`}>Blocker / reason (if incomplete)</Label>
            <Textarea
              id={`blocker-${t.id}`}
              name={`blocker-${t.id}`}
              rows={2}
              defaultValue={t.blockerReason ?? ""}
            />
          </div>
        </div>
      ))}
      <EodDaySummary tasks={quantityInputs} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="w-full sm:w-auto">
          {submitLabel}
        </Button>
        {cancelHref && (
          <Button asChild variant="ghost" size="sm">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
