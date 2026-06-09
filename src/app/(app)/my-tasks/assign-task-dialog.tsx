"use client";

import { useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Plus, SendHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { displayName } from "@/lib/user-display-name";
import { assignTaskToUser } from "./board-actions";
import { notifyAssignedByMeRefresh } from "./my-tasks-events";

export type AssignableTaskMember = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  title: string | null;
};

const MAX_TASK_ROWS = 25;

function emptyTaskRow() {
  return { id: crypto.randomUUID(), title: "" };
}

export function AssignTaskDialog({ members }: { members: AssignableTaskMember[] }) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [taskRows, setTaskRows] = useState([emptyTaskRow()]);
  const [description, setDescription] = useState("");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(
    () => new Set(members[0]?.id ? [members[0].id] : []),
  );

  function openDialog() {
    setTaskRows([emptyTaskRow()]);
    setDescription("");
    setSelectedAssigneeIds(new Set(members[0]?.id ? [members[0].id] : []));
    queueMicrotask(() => {
      dlgRef.current?.showModal();
      titleInputRef.current?.focus();
    });
  }

  function closeDialog() {
    dlgRef.current?.close();
  }

  function toggleAssignee(userId: string) {
    setSelectedAssigneeIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        if (next.size === 1) return next;
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function updateTaskRowTitle(rowId: string, title: string) {
    setTaskRows((rows) => rows.map((row) => (row.id === rowId ? { ...row, title } : row)));
  }

  function addTaskRow() {
    setTaskRows((rows) => (rows.length >= MAX_TASK_ROWS ? rows : [...rows, emptyTaskRow()]));
  }

  function removeTaskRow(rowId: string) {
    setTaskRows((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== rowId)));
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();

    const titles = taskRows.map((row) => row.title.trim()).filter((title) => title.length > 0);
    if (!titles.length) {
      toast.error("Add at least one task title.");
      return;
    }
    if (selectedAssigneeIds.size === 0) {
      toast.error("Choose at least one teammate.");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      for (const title of titles) fd.append("titles", title);
      fd.set("description", description);
      for (const userId of selectedAssigneeIds) fd.append("assignedToUserIds", userId);

      const result = await assignTaskToUser(fd);
      if (!result.ok || !result.created?.length) {
        toast.error(result.error || "Could not assign tasks.");
        return;
      }

      closeDialog();
      notifyAssignedByMeRefresh();

      const count = result.created.length;
      const assigneeCount = selectedAssigneeIds.size;
      const taskCount = titles.length;
      if (count === 1 && result.userId && result.taskId) {
        toast.success("Task assigned.");
        router.push(`/my-tasks?userId=${encodeURIComponent(result.userId)}&task=${encodeURIComponent(result.taskId)}`);
      } else {
        toast.success(
          `Assigned ${taskCount} task${taskCount === 1 ? "" : "s"} to ${assigneeCount} teammate${assigneeCount === 1 ? "" : "s"} (${count} total).`,
        );
        router.refresh();
      }
    });
  }

  const assigneeCount = selectedAssigneeIds.size;
  const filledTaskCount = taskRows.filter((row) => row.title.trim().length > 0).length;
  const totalCreates = filledTaskCount * assigneeCount;

  return (
    <>
      <Button type="button" variant="primary" size="sm" className="shrink-0 gap-1.5" onClick={openDialog}>
        <SendHorizontal className="size-4" aria-hidden />
        Assign task
      </Button>

      <dialog
        ref={dlgRef}
        aria-labelledby="assign-task-heading"
        aria-modal="true"
        className="fixed left-[50%] top-[40%] z-50 w-[calc(100vw-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-xl border border-ink-200 bg-white p-5 text-ink-800 shadow-xl [&::backdrop]:bg-black/40"
      >
        <h2 id="assign-task-heading" className="text-lg font-semibold text-ink-700">
          Assign tasks
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Add one or more tasks and pick who should get them. Multiple teammates each receive their own copy to track
          independently.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label>Tasks</Label>
            <div className="space-y-2">
              {taskRows.map((row, index) => (
                <div key={row.id} className="flex items-center gap-2">
                  <Input
                    ref={index === 0 ? titleInputRef : undefined}
                    name="titles"
                    autoComplete="off"
                    placeholder={index === 0 ? "e.g. Share final deck with finance" : "Another task title"}
                    maxLength={500}
                    disabled={pending}
                    value={row.title}
                    onChange={(e) => updateTaskRowTitle(row.id, e.target.value)}
                    required={index === 0}
                  />
                  {taskRows.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 px-2 text-ink-500 hover:text-red-600"
                      disabled={pending}
                      aria-label="Remove task row"
                      onClick={() => removeTaskRow(row.id)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={pending || taskRows.length >= MAX_TASK_ROWS}
              onClick={addTaskRow}
            >
              <Plus className="size-4" aria-hidden />
              Add another task
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Assign to</Label>
            {members.length === 0 ? (
              <p className="text-sm text-ink-500">No teammates available.</p>
            ) : (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-ink-100 p-2">
                {members.map((member) => {
                  const checked = selectedAssigneeIds.has(member.id);
                  return (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-ink-50"
                    >
                      <input
                        type="checkbox"
                        name="assignedToUserIds"
                        value={member.id}
                        className="mt-0.5"
                        checked={checked}
                        disabled={pending}
                        onChange={() => toggleAssignee(member.id)}
                      />
                      <span className="min-w-0 text-sm text-ink-700">
                        {displayName(member)}
                        {member.title ? <span className="text-ink-500"> · {member.title}</span> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            {assigneeCount > 1 ? (
              <p className="text-xs text-ink-500">
                Each teammate gets their own copy of every task, linked so you can compare progress.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assign-task-description">Description</Label>
            <Textarea
              id="assign-task-description"
              name="description"
              placeholder="Shared notes, links, or acceptance criteria for all tasks above."
              maxLength={32000}
              disabled={pending}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {filledTaskCount > 0 && assigneeCount > 0 ? (
            <p className="text-xs text-ink-500">
              This will create {totalCreates} task{totalCreates === 1 ? "" : "s"}.
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" className="text-ink-600" disabled={pending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending || members.length === 0}>
              {pending ? "Assigning…" : totalCreates > 1 ? `Assign ${totalCreates} tasks` : "Assign task"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
