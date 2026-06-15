"use client";

import { useRef, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import type { TeamTaskBoardRow } from "@/lib/work-tracking/snapshots";
import { updateDailyTask } from "../actions";
import { QuantityUnitFields } from "./quantity-unit-fields";

type TaskTypeOption = { id: string; name: string; departmentId: string };
type KrOption = { id: string; title: string; departmentId: string; taskTypeName: string | null };

export function EditDailyTaskDialog({
  row,
  taskTypes,
  keyResults,
}: {
  row: TeamTaskBoardRow;
  taskTypes: TaskTypeOption[];
  keyResults: KrOption[];
}) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const deptTaskTypes = taskTypes.filter((t) => t.departmentId === row.departmentId);
  const deptKrs = keyResults.filter((kr) => kr.departmentId === row.departmentId);

  function openDialog() {
    dlgRef.current?.showModal();
  }

  function closeDialog() {
    dlgRef.current?.close();
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    fd.set("taskId", row.id);

    startTransition(async () => {
      try {
        await updateDailyTask(fd);
        toast.success("Task updated");
        closeDialog();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update task");
      }
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-ink-500" onClick={openDialog}>
        Edit
      </Button>

      <dialog
        ref={dlgRef}
        aria-labelledby={`edit-task-${row.id}`}
        aria-modal="true"
        className="fixed left-[50%] top-[40%] z-50 w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl border border-ink-200 bg-white p-5 text-ink-800 shadow-xl [&::backdrop]:bg-black/40"
      >
        <h2 id={`edit-task-${row.id}`} className="text-lg font-semibold text-ink-700">
          Edit task
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {row.memberName} — {row.taskName}
        </p>

        <form onSubmit={onSubmit} className="mt-4 grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor={`edit-name-${row.id}`}>Task name</Label>
            <Input id={`edit-name-${row.id}`} name="projectName" required defaultValue={row.taskName} />
          </div>
          <div>
            <Label htmlFor={`edit-qty-${row.id}`}>Target quantity</Label>
            <Input
              id={`edit-qty-${row.id}`}
              name="targetQuantity"
              type="number"
              min={0.01}
              step="0.01"
              required
              defaultValue={row.targetQuantity}
            />
          </div>
          <QuantityUnitFields defaultUnit={row.quantityUnit} idPrefix={`edit-${row.id}`} />
          <div>
            <Label htmlFor={`edit-type-${row.id}`}>Task type</Label>
            <Select id={`edit-type-${row.id}`} name="taskTypeId" defaultValue={row.taskTypeId}>
              {deptTaskTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`edit-priority-${row.id}`}>Priority</Label>
            <Select id={`edit-priority-${row.id}`} name="priority" defaultValue={row.priority}>
              <option value="P1">P1 — Urgent</option>
              <option value="P2">P2 — Normal</option>
              <option value="P3">P3 — Low</option>
            </Select>
          </div>
          <div>
            <Label htmlFor={`edit-due-${row.id}`}>Due by (time)</Label>
            <Input id={`edit-due-${row.id}`} name="dueByTime" type="time" defaultValue={row.dueByTime ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={`edit-kr-${row.id}`}>Linked key result</Label>
            <Select id={`edit-kr-${row.id}`} name="keyResultId" defaultValue={row.keyResultId ?? ""}>
              <option value="">— None —</option>
              {deptKrs.map((kr) => (
                <option key={kr.id} value={kr.id}>
                  {kr.title} ({kr.taskTypeName ?? "any"})
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" className="text-ink-600" disabled={pending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
