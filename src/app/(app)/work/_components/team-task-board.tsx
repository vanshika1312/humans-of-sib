"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TeamTaskBoardRow } from "@/lib/work-tracking/snapshots";
import { deleteDailyTask } from "../actions";
import { EditDailyTaskDialog } from "./edit-daily-task-dialog";

const EOD_TONE: Record<string, "green" | "orange" | "red" | "ink"> = {
  COMPLETED: "green",
  PARTIAL: "orange",
  NOT_STARTED: "red",
};

type Filter = "all" | "in_progress" | "done";

type TaskTypeOption = { id: string; name: string; departmentId: string };
type KrOption = { id: string; title: string; departmentId: string; taskTypeName: string | null };

function matchesFilter(status: string | null, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "done") return status === "COMPLETED";
  return status === "PARTIAL" || status === "NOT_STARTED" || status === null;
}

function DeleteTaskButton({ taskId, taskName }: { taskId: string; taskName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Delete "${taskName}"? This cannot be undone.`)) return;

    const fd = new FormData();
    fd.set("taskId", taskId);

    startTransition(async () => {
      try {
        await deleteDailyTask(fd);
        toast.success("Task deleted");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete task");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
      disabled={pending}
      onClick={onDelete}
    >
      {pending ? "…" : "Delete"}
    </Button>
  );
}

export function TeamTaskBoard({
  rows,
  taskTypes,
  keyResults,
}: {
  rows: TeamTaskBoardRow[];
  taskTypes: TaskTypeOption[];
  keyResults: KrOption[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtered = rows.filter((r) => matchesFilter(r.eodStatus, filter));
  const hasManageable = rows.some((r) => r.canManage);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["in_progress", "In progress"],
            ["done", "Done"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-3 py-1 text-xs rounded-md border ${
              filter === key
                ? "bg-ink-100 border-ink-200 text-ink-800 font-medium"
                : "border-transparent text-ink-500 hover:bg-ink-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-500 py-4 text-center">No tasks match this filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500 border-b border-ink-100">
                <th className="pb-2 pr-3">Member</th>
                <th className="pb-2 pr-3">Task</th>
                <th className="pb-2 pr-3">Assigned</th>
                <th className="pb-2 pr-3">Completed</th>
                <th className="pb-2 pr-3">Unit</th>
                <th className="pb-2 pr-3">Status</th>
                <th className={`pb-2 ${hasManageable ? "pr-3" : ""}`}>Linked KR</th>
                {hasManageable && <th className="pb-2 w-28">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-ink-50">
                  <td className="py-2 pr-3 font-medium text-ink-700">{row.memberName}</td>
                  <td className="py-2 pr-3">{row.taskName}</td>
                  <td className="py-2 pr-3">{row.targetQuantity}</td>
                  <td className="py-2 pr-3">{row.actualQuantity ?? "—"}</td>
                  <td className="py-2 pr-3 text-ink-500">{row.quantityUnit}</td>
                  <td className="py-2 pr-3">
                    {row.eodStatus ? (
                      <Badge tone={EOD_TONE[row.eodStatus] ?? "ink"}>
                        {row.eodStatus.replace("_", " ")}
                      </Badge>
                    ) : (
                      <Badge tone="ink">Pending</Badge>
                    )}
                  </td>
                  <td className={`py-2 text-ink-500 text-xs ${hasManageable ? "pr-3" : ""}`}>
                    {row.keyResultTitle ?? "—"}
                  </td>
                  {hasManageable && (
                    <td className="py-2">
                      {row.canManage ? (
                        <div className="flex items-center gap-0.5">
                          <EditDailyTaskDialog row={row} taskTypes={taskTypes} keyResults={keyResults} />
                          <DeleteTaskButton taskId={row.id} taskName={row.taskName} />
                        </div>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
