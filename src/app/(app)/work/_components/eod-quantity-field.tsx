"use client";

import { useState } from "react";
import { Label, Input, Select } from "@/components/ui/input";
import { suggestEodStatus } from "@/lib/work-tracking/efficiency";
import type { DailyTaskEodStatus } from "@/generated/prisma";

export function EodQuantityField({
  taskId,
  targetQuantity,
  quantityUnit,
  defaultActual,
  defaultStatus,
  defaultCarryForward,
  onValuesChange,
}: {
  taskId: string;
  targetQuantity: number;
  quantityUnit: string;
  defaultActual: number;
  defaultStatus: string | null;
  defaultCarryForward?: boolean;
  onValuesChange?: (actual: number, status: string) => void;
}) {
  const [actual, setActual] = useState(defaultActual);
  const suggested = suggestEodStatus(targetQuantity, actual);
  const [status, setStatus] = useState<DailyTaskEodStatus>(
    (defaultStatus as DailyTaskEodStatus) ?? suggested,
  );
  const pct = targetQuantity > 0 ? Math.min(100, Math.round((actual / targetQuantity) * 100)) : 0;

  function handleActualChange(next: number) {
    setActual(next);
    onValuesChange?.(next, status);
  }

  function handleStatusChange(next: DailyTaskEodStatus) {
    setStatus(next);
    onValuesChange?.(actual, next);
  }

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label htmlFor={`status-${taskId}`}>Status</Label>
          <Select
            id={`status-${taskId}`}
            name={`status-${taskId}`}
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as DailyTaskEodStatus)}
          >
            <option value="COMPLETED">Completed</option>
            <option value="PARTIAL">Partial</option>
            <option value="NOT_STARTED">Not started</option>
          </Select>
        </div>
        <div>
          <Label htmlFor={`actual-${taskId}`}>Delivered ({quantityUnit})</Label>
          <Input
            id={`actual-${taskId}`}
            name={`actual-${taskId}`}
            type="number"
            min={0}
            step="0.01"
            value={actual}
            onChange={(e) => handleActualChange(Number(e.target.value))}
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input
              type="checkbox"
              name={`carry-${taskId}`}
              defaultChecked={defaultCarryForward ?? suggested !== "COMPLETED"}
            />
            Carry forward tomorrow
          </label>
        </div>
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-xs text-ink-500 mb-1">
          <span>
            {actual} / {targetQuantity} {quantityUnit}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-ink-100 rounded overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </>
  );
}
