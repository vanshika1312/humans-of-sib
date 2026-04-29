"use client";

import { useTransition, useState } from "react";
import { type BulkImportResult } from "../actions";

type Props = {
  year:  number;
  month: number;
  hasSheetUrl: boolean;
  syncAction: (formData: FormData) => Promise<BulkImportResult>;
};

export function SyncButton({ year, month, hasSheetUrl, syncAction }: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult]          = useState<BulkImportResult | null>(null);

  if (!hasSheetUrl) return null;

  function handleClick() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("year",  String(year));
      fd.set("month", String(month));
      const res = await syncAction(fd);
      setResult(res);
      // Clear the success banner after 6 s
      setTimeout(() => setResult(null), 6000);
    });
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-ink-200 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-colors disabled:opacity-60"
      >
        {/* Refresh icon */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={isPending ? "animate-spin" : ""}
        >
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
          <path d="M21 3v5h-5"/>
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
          <path d="M8 16H3v5"/>
        </svg>
        {isPending ? "Syncing…" : "Sync from Sheet"}
      </button>

      {/* Inline result toast */}
      {result && (
        <div
          className={`absolute top-full mt-1.5 right-0 z-10 min-w-[220px] rounded-lg border px-3 py-2 text-xs shadow-md bg-white ${
            result.errors.length > 0
              ? "border-red-200 text-red-700"
              : "border-green-200 text-green-700"
          }`}
        >
          {result.errors.length === 0 ? (
            <span>✓ {result.imported} rows synced{result.skipped > 0 ? `, ${result.skipped} skipped` : ""}</span>
          ) : (
            <ul className="space-y-0.5 max-w-xs">
              {result.errors.slice(0, 4).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.errors.length > 4 && (
                <li>…and {result.errors.length - 4} more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
