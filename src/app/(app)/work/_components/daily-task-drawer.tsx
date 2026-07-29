"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Paperclip, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { displayName } from "@/lib/user-display-name";
import { formatQuantityLabel } from "@/lib/work-tracking/config";
import type { ClientDailyWorkTask } from "../actions";
import {
  addDailyWorkTaskAttachment,
  deleteDailyWorkTaskAttachment,
  loadDailyWorkTaskForClient,
  updateDailyWorkTaskNotes,
} from "../actions";

const PRIORITY_TONE: Record<string, "red" | "orange" | "ink"> = {
  P1: "red",
  P2: "orange",
  P3: "ink",
};

const EOD_STATUS_TONE: Record<string, "green" | "orange" | "red" | "sky"> = {
  COMPLETED: "green",
  PARTIAL: "orange",
  NOT_STARTED: "red",
};

export function DailyTaskDrawer({
  task,
  onTaskChanged,
  onClose,
}: {
  task: ClientDailyWorkTask;
  onTaskChanged: (task: ClientDailyWorkTask) => void;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(task.assigneeNotes ?? "");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const canEdit = task.canEdit;
  const savedNotes = task.assigneeNotes ?? "";
  const notesDirty = notes !== savedNotes;

  useEffect(() => {
    setNotes(task.assigneeNotes ?? "");
  }, [task.assigneeNotes, task.id]);

  async function syncLatestTask() {
    const latest = await loadDailyWorkTaskForClient(task.id);
    if (latest.ok) onTaskChanged(latest.task);
  }

  function saveNotes() {
    startTransition(async () => {
      const r = await updateDailyWorkTaskNotes(task.id, notes);
      if (!r.ok) {
        toast.error(r.error || "Could not save notes");
        return;
      }
      toast.success("Notes saved");
      await syncLatestTask();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink-900/40 p-4 md:p-6" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <aside
        role="dialog"
        aria-labelledby="daily-task-drawer-title"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border overflow-hidden flex flex-col max-h-[min(920px,calc(100vh-48px))]"
      >
        <header className="hairline border-b px-4 py-3 flex justify-between gap-3 items-start">
          <div className="min-w-0 flex-1">
            <h2 id="daily-task-drawer-title" className="text-lg font-semibold text-ink-800 leading-snug">
              {task.projectName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={PRIORITY_TONE[task.priority] ?? "ink"}>{task.priority}</Badge>
              <Badge tone="sky">{task.taskType.name}</Badge>
              {task.eodStatus && (
                <Badge tone={EOD_STATUS_TONE[task.eodStatus] ?? "ink"}>
                  {task.eodStatus.replace("_", " ")}
                </Badge>
              )}
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <dl className="grid gap-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-ink-500">Target</dt>
              <dd className="font-medium text-ink-700">
                {formatQuantityLabel(task.targetQuantity, task.quantityUnit)}
              </dd>
            </div>
            {task.dueByTime && (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-500">Due by</dt>
                <dd className="font-medium text-ink-700">{task.dueByTime}</dd>
              </div>
            )}
            {task.keyResult && (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-500">Key result</dt>
                <dd className="font-medium text-ink-700 text-right">{task.keyResult.title}</dd>
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-ink-500">Assigned by</dt>
              <dd className="font-medium text-ink-700">{displayName(task.assignedBy)}</dd>
            </div>
            {task.eodStatus && task.eodStatus !== "NOT_STARTED" && task.actualQuantity != null && (
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-500">Delivered</dt>
                <dd className="font-medium text-emerald-700">
                  {formatQuantityLabel(task.actualQuantity, task.quantityUnit)}
                </dd>
              </div>
            )}
          </dl>

          <div>
            <Label htmlFor="daily-task-notes">Notes</Label>
            <Textarea
              id="daily-task-notes"
              value={notes}
              disabled={!canEdit || isPending}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="mt-1 text-sm"
              placeholder={canEdit ? "Add work notes, links, or context…" : "No notes yet."}
            />
            {canEdit && (
              <div className="mt-2 flex items-center gap-2">
                <Button type="button" size="sm" disabled={!notesDirty || isPending} onClick={saveNotes}>
                  {isPending ? "Saving…" : "Save notes"}
                </Button>
                {notesDirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
              </div>
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
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-red-600 h-7"
                      aria-label={`Remove ${a.fileName}`}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await deleteDailyWorkTaskAttachment(a.id);
                          if (!r.ok) toast.error(r.error || "Could not remove");
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
            {canEdit && (
              <div className="space-y-2">
                <label className="block text-xs text-ink-500">
                  Choose a file to upload (PDF / Word / images / text). Uploads immediately.
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    disabled={uploadingAttachment || isPending}
                    className="block mt-1 text-sm max-w-full disabled:opacity-60"
                    onChange={(e) => {
                      const input = e.currentTarget;
                      const file = input.files?.[0];
                      if (!file) return;
                      startTransition(async () => {
                        setUploadingAttachment(true);
                        try {
                          const fd = new FormData();
                          fd.set("file", file);
                          const r = await addDailyWorkTaskAttachment(task.id, fd);
                          input.value = "";
                          if (!r.ok) toast.error(r.error || "Upload failed");
                          else {
                            toast.success("Attachment uploaded");
                            await syncLatestTask();
                          }
                        } finally {
                          setUploadingAttachment(false);
                        }
                      });
                    }}
                  />
                </label>
                {uploadingAttachment ? <p className="text-xs font-medium text-sky-700">Uploading…</p> : null}
              </div>
            )}
          </div>
        </div>

        <footer className="hairline border-t px-4 py-3">
          <Link
            href={`/work?date=${encodeURIComponent(task.workDate)}&tab=eod`}
            className="text-sm text-sky-600 hover:underline"
          >
            Submit EOD for {task.workDate}
          </Link>
        </footer>
      </aside>
    </div>
  );
}

export function DailyTaskDrawerLoader({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<ClientDailyWorkTask | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadDailyWorkTaskForClient(taskId).then((r) => {
      if (cancelled) return;
      if (!r.ok) {
        setError(r.error);
        setLoading(false);
        return;
      }
      setTask(r.task);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
        <div className="rounded-xl bg-white px-6 py-4 shadow-xl flex items-center gap-2 text-sm text-ink-600">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading task…
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
        <div className="rounded-xl bg-white px-6 py-4 shadow-xl max-w-sm text-center">
          <p className="text-sm text-ink-600">{error ?? "Task not found."}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DailyTaskDrawer
      task={task}
      onTaskChanged={setTask}
      onClose={onClose}
    />
  );
}
