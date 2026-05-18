"use client";

import { useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
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

export function AssignTaskDialog({ members }: { members: AssignableTaskMember[] }) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState(members[0]?.id ?? "");

  function openDialog() {
    setTitle("");
    setDescription("");
    setAssignedToUserId(members[0]?.id ?? "");
    queueMicrotask(() => {
      dlgRef.current?.showModal();
      titleInputRef.current?.focus();
    });
  }

  function closeDialog() {
    dlgRef.current?.close();
  }

  function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    startTransition(async () => {
      const fd = new FormData(ev.currentTarget);
      const result = await assignTaskToUser(fd);
      if (!result.ok || !result.userId || !result.taskId) {
        toast.error(result.error || "Could not assign task.");
        return;
      }
      closeDialog();
      notifyAssignedByMeRefresh();
      router.push(`/my-tasks?userId=${encodeURIComponent(result.userId)}&task=${encodeURIComponent(result.taskId)}`);
      router.refresh();
    });
  }

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
          Assign a task
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Assign work to anyone in the organisation. You&apos;ll only track the tasks you assigned, not their full board.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="assign-task-title">Task title</Label>
            <Input
              ref={titleInputRef}
              id="assign-task-title"
              name="title"
              autoComplete="off"
              placeholder="e.g. Share final deck with finance"
              maxLength={500}
              disabled={pending}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assign-task-user">Assign to</Label>
            <Select
              id="assign-task-user"
              name="assignedToUserId"
              disabled={pending || members.length === 0}
              value={assignedToUserId}
              onChange={(e) => setAssignedToUserId(e.target.value)}
              required
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {displayName(member)}
                  {member.title ? ` · ${member.title}` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assign-task-description">Description</Label>
            <Textarea
              id="assign-task-description"
              name="description"
              placeholder="Add notes, links, or acceptance criteria."
              maxLength={32000}
              disabled={pending}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>

          <p className="text-xs text-ink-500">
            New assigned tasks land in the teammate&apos;s first active column. They can move it through their board, and you can
            still update the task details and status.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" className="text-ink-600" disabled={pending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending || members.length === 0}>
              {pending ? "Assigning…" : "Assign task"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
