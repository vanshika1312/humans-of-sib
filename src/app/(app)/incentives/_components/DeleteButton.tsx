"use client";

import { useTransition } from "react";

export function DeleteButton({
  sheetId,
  userName,
  deleteAction,
}: {
  sheetId: string;
  userName: string;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Remove ${userName}'s revenue data for this month? This cannot be undone.`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("sheetId", sheetId);
      await deleteAction(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="h-7 px-2.5 rounded-md border border-red-200 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
    >
      {isPending ? "…" : "Remove"}
    </button>
  );
}
