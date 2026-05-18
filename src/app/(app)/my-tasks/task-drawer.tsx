"use client";

import { useEffect, useState, useTransition } from "react";
import { Paperclip, MessageSquareText, Trash2, GripVertical, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/user-display-name";
import type { ClientBoardTask } from "./task-kanban-types";
import {
  addPersonalTaskAttachment,
  addTaskComment,
  deleteBoardTask,
  deletePersonalTaskAttachment,
  deleteTaskComment,
  updateBoardTaskDetails,
} from "./board-actions";

export function TaskDrawer({
  task,
  ownerUserId,
  viewerId,
  readOnlyBoard,
  onClose,
}: {
  task: ClientBoardTask;
  ownerUserId: string;
  viewerId: string;
  readOnlyBoard: boolean;
  onClose: () => void;
}) {
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description ?? "");
  const canEditOwnedTask = !readOnlyBoard;

  useEffect(() => {
    setTitle(task.title);
    setDesc(task.description ?? "");
  }, [task.id, task.title, task.description]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/40 p-4 md:p-6" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <aside
        role="dialog"
        aria-labelledby="task-drawer-title"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border overflow-hidden flex flex-col max-h-[min(920px,calc(100vh-48px))]"
      >
        <header className="hairline border-b px-4 py-3 flex justify-between gap-3 items-start">
          <div className="min-w-0 flex-1 flex gap-2">
            {canEditOwnedTask ? (
              <span className="text-ink-200 pt-2">
                <GripVertical className="size-5" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <Label htmlFor="task-drawer-title" className="sr-only mb-0">
                Title
              </Label>
              <Input
                id="task-drawer-title"
                value={title}
                disabled={!canEditOwnedTask}
                onChange={(e) => setTitle(e.target.value)}
                className="font-semibold text-ink-800 border-0 px-0 h-auto shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
          <Button variant="ghost" size="sm" aria-label="Close panel" type="button" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
          <div>
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={desc}
              disabled={!canEditOwnedTask}
              onChange={(e) => setDesc(e.target.value)}
              rows={6}
              className="mt-1 text-sm"
              placeholder={canEditOwnedTask ? "Notes, checklist, links…" : undefined}
            />
            {canEditOwnedTask && (
              <Button
                type="button"
                size="sm"
                variant="accent"
                className="mt-2"
                onClick={() =>
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.append("title", title.trim());
                    fd.append("description", desc);
                    await updateBoardTaskDetails(ownerUserId, task.id, fd);
                    toast.success("Saved");
                  })
                }
              >
                Save details
              </Button>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2 inline-flex items-center gap-1.5">
              <Paperclip className="size-3.5" /> Attachments
            </h4>
            <ul className="space-y-2 text-sm mb-3">
              {task.attachments.length === 0 && <li className="text-ink-400">None yet.</li>}
              {task.attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 flex-wrap justify-between rounded-md bg-ink-50 px-2 py-1.5 hairline"
                >
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-600 hover:underline truncate"
                  >
                    {a.fileName}
                  </a>
                  {canEditOwnedTask && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-red-600 h-7"
                      aria-label={`Remove ${a.fileName}`}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await deletePersonalTaskAttachment(ownerUserId, a.id);
                          if (!r.ok) toast.error("Could not remove");
                          else toast.success("Removed");
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {canEditOwnedTask && (
              <label className="block text-xs text-ink-500">
                Upload file (PDF / Word / images / text)
                <input
                  type="file"
                  className="block mt-1 text-sm max-w-full"
                  onChange={(e) => {
                    const input = e.currentTarget;
                    const file = input.files?.[0];
                    if (!file) return;
                    startTransition(async () => {
                      const fd = new FormData();
                      fd.set("file", file);
                      const r = await addPersonalTaskAttachment(ownerUserId, task.id, fd);
                      input.value = "";
                      if (!r.ok) toast.error(r.error || "Upload failed");
                      else toast.success("Uploaded");
                    });
                  }}
                />
              </label>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2 inline-flex items-center gap-1.5">
              <MessageSquareText className="size-3.5" /> Comments
            </h4>
            <ul className="space-y-3 mb-3">
              {task.comments.map((c) => {
                const dn = displayName({
                  id: c.author.id,
                  name: c.author.name,
                  firstName: c.author.firstName,
                  lastName: c.author.lastName,
                  email: c.author.email,
                });
                const showDel = viewerId === c.authorId || viewerId === ownerUserId;
                return (
                  <li key={c.id} className={cn("rounded-lg border px-3 py-2 bg-ink-50/80 text-sm space-y-1")}>
                    <div className="flex justify-between gap-2 text-[11px] text-ink-500">
                      <span className="font-semibold text-ink-700">{dn}</span>
                      <span>
                        {new Date(c.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="text-ink-700 whitespace-pre-wrap">{c.body}</p>
                    {showDel && (
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline font-medium"
                        onClick={() =>
                          startTransition(async () => {
                            const r = await deleteTaskComment(c.id);
                            if (!r.ok) toast.error("Could not delete comment");
                          })
                        }
                      >
                        Delete
                      </button>
                    )}
                  </li>
                );
              })}
              {task.comments.length === 0 && <li className="text-ink-400 text-sm">No comments yet.</li>}
            </ul>
            <form
              action={async (formData) => {
                const out = await addTaskComment(task.id, formData);
                if (!out.ok) toast.error(out.error || "Could not comment");
                else toast.success("Posted");
              }}
              className="space-y-2"
            >
              <Textarea name="body" placeholder="Write a comment…" rows={3} required minLength={2} />
              <Button type="submit" size="sm" variant="primary">
                Post comment
              </Button>
            </form>
          </div>

          {canEditOwnedTask && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="w-full"
              onClick={() => {
                if (!window.confirm("Delete this task and all attachments / comments?")) return;
                startTransition(async () => {
                  await deleteBoardTask(ownerUserId, task.id);
                  toast.success("Task deleted");
                  onClose();
                });
              }}
            >
              Delete task
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
