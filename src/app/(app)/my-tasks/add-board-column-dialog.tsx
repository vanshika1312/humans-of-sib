"use client";

import { useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createPersonalTaskStage } from "./board-actions";

export function AddBoardColumnDialog({ ownerUserId }: { ownerUserId: string }) {
  const dlgRef = useRef<HTMLDialogElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function openDialog() {
    setTitle("");
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
    const fd = new FormData(ev.currentTarget);
    const raw = fd.get("title");
    const t = typeof raw === "string" ? raw.trim() : "";
    if (t.length) fd.set("title", t.slice(0, 160));

    startTransition(async () => {
      const r = await createPersonalTaskStage(ownerUserId, fd);
      if (r.ok) {
        closeDialog();
        return;
      }
      toast.error("error" in r ? r.error : "Could not add column.");
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5 border-dashed border-slate-300 text-slate-700"
        onClick={openDialog}
      >
        <Plus className="size-4" aria-hidden />
        Add column
      </Button>

      <dialog
        ref={dlgRef}
        aria-labelledby="board-add-column-heading"
        aria-modal="true"
        className="fixed left-[50%] top-[40%] z-50 w-[calc(100vw-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl border border-ink-200 bg-white p-5 text-ink-800 shadow-xl [&::backdrop]:bg-black/40"
      >
        <h2 id="board-add-column-heading" className="text-lg font-semibold text-ink-700">
          New column
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Choose a status name — you can rename it anytime from the column header.
        </p>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="board-column-title">Column name</Label>
            <Input
              ref={titleInputRef}
              id="board-column-title"
              name="title"
              autoComplete="off"
              placeholder="e.g. In review"
              maxLength={160}
              disabled={pending}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" className="text-ink-600" disabled={pending} onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Adding…" : "Add column"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
