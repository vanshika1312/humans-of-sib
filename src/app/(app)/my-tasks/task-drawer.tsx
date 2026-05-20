"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Calendar, CheckSquare, MessageSquareText, Paperclip, Plus, Tag, Trash2, UserPlus, GripVertical, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { displayName } from "@/lib/user-display-name";
import { formatCalendarDate, utcCalendarDateToInputValue } from "@/lib/calendar-date";
import type { ClientBoardLabel, ClientBoardStage, ClientBoardTask, ClientTaskAssignee } from "@/app/(app)/my-tasks/task-kanban-types";
import {
  addPersonalTaskAttachment,
  addChecklistItem,
  addTaskComment,
  addTaskMember,
  createBoardLabel,
  createTaskChecklist,
  deleteChecklist,
  deleteChecklistItem,
  deleteBoardTask,
  deletePersonalTaskAttachment,
  deleteTaskComment,
  loadBoardTaskForClient,
  removeTaskMember,
  renameChecklist,
  setTaskDueDate,
  setTaskLabels,
  toggleChecklistItem,
  updateBoardTaskStage,
  updateBoardTaskDetails,
} from "./board-actions";

const LABEL_COLORS: { id: string; label: string; pill: string }[] = [
  { id: "slate", label: "Slate", pill: "bg-slate-200 text-slate-800" },
  { id: "sky", label: "Sky", pill: "bg-sky-200 text-sky-800" },
  { id: "emerald", label: "Emerald", pill: "bg-emerald-200 text-emerald-800" },
  { id: "amber", label: "Amber", pill: "bg-amber-200 text-amber-900" },
  { id: "rose", label: "Rose", pill: "bg-rose-200 text-rose-900" },
  { id: "violet", label: "Violet", pill: "bg-violet-200 text-violet-900" },
];

function labelPillClass(color: string | null | undefined) {
  const hit = LABEL_COLORS.find((c) => c.id === color);
  return hit?.pill ?? "bg-slate-200 text-slate-800";
}

export function TaskDrawer({
  task,
  stages,
  boardLabels,
  memberOptions,
  ownerUserId,
  viewerId,
  readOnlyBoard,
  onTaskChanged,
  refreshTask,
  onClose,
}: {
  task: ClientBoardTask;
  stages: ClientBoardStage[];
  boardLabels: ClientBoardLabel[];
  memberOptions: ClientTaskAssignee[];
  ownerUserId: string;
  viewerId: string;
  readOnlyBoard: boolean;
  onTaskChanged: (task: ClientBoardTask) => void;
  refreshTask: () => Promise<void>;
  onClose: () => void;
}) {
  const [, startTransition] = useTransition();
  const commentFormRef = useRef<HTMLFormElement | null>(null);
  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description ?? "");
  const [selectedStageId, setSelectedStageId] = useState(task.stageId);
  const canEditOwnedTask = !readOnlyBoard || task.assignedBy?.id === viewerId || task.assignedTo.id === viewerId;

  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [dueYmd, setDueYmd] = useState(() => utcCalendarDateToInputValue(task.dueDate));
  const [addMemberId, setAddMemberId] = useState<string>("");
  const [localBoardLabels, setLocalBoardLabels] = useState<ClientBoardLabel[]>(() => boardLabels);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[1]?.id ?? "sky");
  const [newChecklistTitle, setNewChecklistTitle] = useState("Checklist");
  const [newItemByChecklistId, setNewItemByChecklistId] = useState<Record<string, string>>({});

  const selectedLabelIds = useMemo(() => new Set(task.labels.map((l) => l.id)), [task.labels]);
  const memberIds = useMemo(() => new Set(task.members.map((m) => m.id)), [task.members]);

  useEffect(() => {
    setDueYmd(utcCalendarDateToInputValue(task.dueDate));
  }, [task.dueDate]);

  useEffect(() => {
    setLocalBoardLabels(boardLabels);
  }, [boardLabels]);

  useEffect(() => {
    setSelectedStageId(task.stageId);
  }, [task.stageId]);

  useEffect(() => {
    setTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    setDesc(task.description ?? "");
  }, [task.description]);

  async function syncLatestTask() {
    const latest = await loadBoardTaskForClient(task.id);
    if (latest.ok) onTaskChanged(latest.task);
    else await refreshTask();
  }

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
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <p>
              Assigned to <span className="font-medium text-slate-800">{displayName(task.assignedTo)}</span>
            </p>
            <p className="mt-1">
              Assigned by{" "}
              <span className="font-medium text-slate-800">
                {task.assignedBy ? displayName(task.assignedBy) : displayName(task.assignedTo)}
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Add to card</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEditOwnedTask}
                onClick={() => document.getElementById("task-members")?.scrollIntoView({ block: "start", behavior: "smooth" })}
                className="justify-start gap-2"
              >
                <UserPlus className="size-4" /> Members
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEditOwnedTask}
                onClick={() => document.getElementById("task-labels")?.scrollIntoView({ block: "start", behavior: "smooth" })}
                className="justify-start gap-2"
              >
                <Tag className="size-4" /> Labels
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEditOwnedTask}
                onClick={() => document.getElementById("task-dates")?.scrollIntoView({ block: "start", behavior: "smooth" })}
                className="justify-start gap-2"
              >
                <Calendar className="size-4" /> Dates
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEditOwnedTask}
                onClick={() => document.getElementById("task-checklists")?.scrollIntoView({ block: "start", behavior: "smooth" })}
                className="justify-start gap-2"
              >
                <CheckSquare className="size-4" /> Checklist
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!canEditOwnedTask) return;
                  attachmentInputRef.current?.click();
                }}
                disabled={!canEditOwnedTask}
                className="col-span-2 justify-start gap-2"
              >
                <Paperclip className="size-4" /> Attachment
              </Button>
            </div>
          </div>

          {canEditOwnedTask && (
            <div>
              <Label htmlFor="task-stage">Status</Label>
              <div className="mt-1 flex items-center gap-2">
                <Select id="task-stage" value={selectedStageId} onChange={(e) => setSelectedStageId(e.target.value)}>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.title}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await updateBoardTaskStage(task.id, selectedStageId);
                      if (!result.ok) {
                        toast.error(result.error || "Could not update status");
                        return;
                      }
                      toast.success("Status updated");
                    })
                  }
                >
                  Update status
                </Button>
              </div>
            </div>
          )}

          <div id="task-members">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2 inline-flex items-center gap-1.5">
              <UserPlus className="size-3.5" /> Members
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              {task.members.length === 0 ? <p className="text-sm text-ink-400">None yet.</p> : null}
              {task.members.map((m) => {
                const dn = displayName(m);
                return (
                  <div key={m.id} className="inline-flex items-center gap-2 rounded-full bg-ink-50 hairline px-2 py-1">
                    <Avatar src={m.image} name={dn} size="xs" className="ring-ink-100" />
                    <span className="text-xs font-medium text-ink-700 max-w-[180px] truncate">{dn}</span>
                    {canEditOwnedTask && (
                      <button
                        type="button"
                        className="text-ink-400 hover:text-red-600 text-xs font-semibold px-1"
                        aria-label={`Remove ${dn}`}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await removeTaskMember(task.id, m.id);
                            if (!r.ok) toast.error(r.error || "Could not remove member");
                            else await syncLatestTask();
                          })
                        }
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {canEditOwnedTask && (
              <div className="mt-2 flex items-center gap-2">
                <Select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} className="h-9">
                  <option value="">Add a person…</option>
                  {memberOptions
                    .filter((u) => !memberIds.has(u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {displayName(u)}
                      </option>
                    ))}
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!addMemberId}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await addTaskMember(task.id, addMemberId);
                      if (!r.ok) toast.error(r.error || "Could not add member");
                      else {
                        setAddMemberId("");
                        await syncLatestTask();
                      }
                    })
                  }
                >
                  Add
                </Button>
              </div>
            )}
          </div>

          <div id="task-labels">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2 inline-flex items-center gap-1.5">
              <Tag className="size-3.5" /> Labels
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              {task.labels.length === 0 ? <p className="text-sm text-ink-400">None yet.</p> : null}
              {task.labels.map((l) => (
                <span key={l.id} className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold", labelPillClass(l.color))}>
                  {l.name}
                </span>
              ))}
            </div>

            {localBoardLabels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {localBoardLabels.map((l) => {
                  const active = selectedLabelIds.has(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      disabled={!canEditOwnedTask}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition",
                        active ? "border-sky-300 bg-sky-50 text-sky-700" : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
                        !canEditOwnedTask && "opacity-60",
                      )}
                      onClick={() =>
                        startTransition(async () => {
                          const next = new Set(Array.from(selectedLabelIds));
                          if (next.has(l.id)) next.delete(l.id);
                          else next.add(l.id);
                          const r = await setTaskLabels(task.id, Array.from(next));
                          if (!r.ok) toast.error(r.error || "Could not update labels");
                          else await syncLatestTask();
                        })
                      }
                    >
                      <span className={cn("h-2.5 w-2.5 rounded-full", labelPillClass(l.color))} aria-hidden />
                      {l.name}
                    </button>
                  );
                })}
              </div>
            )}

            {canEditOwnedTask && viewerId === ownerUserId && (
              <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/60 p-2">
                <p className="text-[11px] font-semibold text-ink-500 mb-2">Create label</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Label name"
                    className="h-9"
                    maxLength={80}
                  />
                  <Select value={newLabelColor} onChange={(e) => setNewLabelColor(e.target.value)} className="h-9 w-[120px]">
                    {LABEL_COLORS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={newLabelName.trim().length === 0}
                    onClick={() =>
                      startTransition(async () => {
                        const out = await createBoardLabel(ownerUserId, newLabelName, newLabelColor);
                        if (!out.ok) {
                          toast.error(out.error || "Could not create label");
                          return;
                        }
                        const created = out.label;
                        setLocalBoardLabels((cur) =>
                          [...cur, created].sort((a, b) => a.sortOrder - b.sortOrder),
                        );
                        setNewLabelName("");
                        const r = await setTaskLabels(task.id, Array.from(new Set([...Array.from(selectedLabelIds), created.id])));
                        if (!r.ok) toast.error(r.error || "Could not assign label");
                        await syncLatestTask();
                      })
                    }
                  >
                    <Plus className="size-4" /> Create
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div id="task-dates">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2 inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" /> Dates
            </h4>
            <p className="text-sm text-ink-600">
              Due date:{" "}
              <span className="font-semibold text-ink-800">{task.dueDate ? formatCalendarDate(task.dueDate) : "None"}</span>
            </p>
            {canEditOwnedTask && (
              <div className="mt-2 flex items-center gap-2">
                <Input type="date" value={dueYmd} onChange={(e) => setDueYmd(e.target.value)} className="h-9" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await setTaskDueDate(task.id, dueYmd);
                      if (!r.ok) toast.error(r.error || "Could not update date");
                      else {
                        toast.success("Saved");
                        await syncLatestTask();
                      }
                    })
                  }
                >
                  Save
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    startTransition(async () => {
                      setDueYmd("");
                      const r = await setTaskDueDate(task.id, "");
                      if (!r.ok) toast.error(r.error || "Could not clear date");
                      else await syncLatestTask();
                    })
                  }
                >
                  Clear
                </Button>
              </div>
            )}
          </div>

          <div id="task-checklists">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-2 inline-flex items-center gap-1.5">
              <CheckSquare className="size-3.5" /> Checklists
            </h4>

            {canEditOwnedTask && (
              <div className="flex items-center gap-2 mb-3">
                <Input
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  placeholder="Checklist title"
                  className="h-9"
                  maxLength={160}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await createTaskChecklist(task.id, newChecklistTitle.trim() || "Checklist");
                      if (!r.ok) toast.error(r.error || "Could not add checklist");
                      else {
                        setNewChecklistTitle("Checklist");
                        await syncLatestTask();
                      }
                    })
                  }
                >
                  <Plus className="size-4" /> Add
                </Button>
              </div>
            )}

            {task.checklists.length === 0 ? <p className="text-sm text-ink-400">None yet.</p> : null}

            <div className="space-y-3">
              {task.checklists.map((cl) => {
                const total = cl.items.length;
                const done = cl.items.filter((it) => it.isDone).length;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                const newItem = newItemByChecklistId[cl.id] ?? "";

                return (
                  <div key={cl.id} className="rounded-xl border border-ink-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Input
                        defaultValue={cl.title}
                        disabled={!canEditOwnedTask}
                        className="h-9 font-semibold text-ink-800"
                        onBlur={(e) => {
                          const next = e.currentTarget.value.trim();
                          if (!canEditOwnedTask) return;
                          if (next.length > 0 && next !== cl.title) {
                            startTransition(async () => {
                              const r = await renameChecklist(cl.id, next);
                              if (!r.ok) toast.error(r.error || "Could not rename checklist");
                              else await syncLatestTask();
                            });
                          }
                        }}
                      />
                      {canEditOwnedTask && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-9 text-red-600"
                          onClick={() =>
                            startTransition(async () => {
                              const r = await deleteChecklist(cl.id);
                              if (!r.ok) toast.error(r.error || "Could not delete checklist");
                              else await syncLatestTask();
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>

                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[11px] text-ink-500">
                        <span>
                          {done}/{total} done
                        </span>
                        <span className="tabular-nums">{pct}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-ink-100">
                        <div className="h-2 rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    <ul className="mt-3 space-y-2">
                      {cl.items.map((it) => (
                        <li key={it.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={it.isDone}
                            disabled={!canEditOwnedTask}
                            onChange={(e) =>
                              startTransition(async () => {
                                const r = await toggleChecklistItem(it.id, e.currentTarget.checked);
                                if (!r.ok) toast.error(r.error || "Could not update item");
                                else await syncLatestTask();
                              })
                            }
                            className="mt-1 rounded border-slate-400"
                          />
                          <span className={cn("flex-1 text-sm text-ink-700", it.isDone && "line-through text-ink-400")}>
                            {it.body}
                          </span>
                          {canEditOwnedTask && (
                            <button
                              type="button"
                              className="text-ink-400 hover:text-red-600 text-xs font-semibold px-1"
                              aria-label="Delete item"
                              onClick={() =>
                                startTransition(async () => {
                                  const r = await deleteChecklistItem(it.id);
                                  if (!r.ok) toast.error(r.error || "Could not delete item");
                                  else await syncLatestTask();
                                })
                              }
                            >
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>

                    {canEditOwnedTask && (
                      <div className="mt-3 flex items-center gap-2">
                        <Input
                          value={newItem}
                          onChange={(e) =>
                            setNewItemByChecklistId((cur) => ({
                              ...cur,
                              [cl.id]: e.target.value,
                            }))
                          }
                          placeholder="Add an item…"
                          className="h-9"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={newItem.trim().length === 0}
                          onClick={() =>
                            startTransition(async () => {
                              const r = await addChecklistItem(cl.id, newItem.trim());
                              if (!r.ok) toast.error(r.error || "Could not add item");
                              else {
                                setNewItemByChecklistId((cur) => ({ ...cur, [cl.id]: "" }));
                                await syncLatestTask();
                              }
                            })
                          }
                        >
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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
                    await syncLatestTask();
                  })
                }
              >
                Save details
              </Button>
            )}
          </div>

          <div id="task-attachments">
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
                          else {
                            toast.success("Removed");
                            await syncLatestTask();
                          }
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
                  ref={attachmentInputRef}
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
                      else {
                        toast.success("Uploaded");
                        await syncLatestTask();
                      }
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
                  name: c.author.name,
                  firstName: c.author.firstName,
                  lastName: c.author.lastName,
                });
                const showDel = viewerId === c.authorId || canEditOwnedTask;
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
                            else {
                              const latest = await loadBoardTaskForClient(task.id);
                              if (latest.ok) onTaskChanged(latest.task);
                              else await refreshTask();
                            }
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
              ref={commentFormRef}
              action={async (formData) => {
                const out = await addTaskComment(task.id, formData);
                if (!out.ok) toast.error(out.error || "Could not comment");
                else {
                  toast.success("Posted");
                  commentFormRef.current?.reset();
                  const latest = await loadBoardTaskForClient(task.id);
                  if (latest.ok) onTaskChanged(latest.task);
                  else await refreshTask();
                }
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
