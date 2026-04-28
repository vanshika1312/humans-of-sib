"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { type BulkImportResult } from "../actions";

const INIT: BulkImportResult = { imported: 0, skipped: 0, errors: [] };

type Props = {
  action: (prev: BulkImportResult, formData: FormData) => Promise<BulkImportResult>;
  templateHref: string;
  year?: number;
  month?: number;
  forTeam?: boolean;
};

export function BulkImportForm({ action, templateHref, year, month, forTeam }: Props) {
  const [result, dispatch, isPending] = useActionState(action, INIT);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasResult = result.imported > 0 || result.skipped > 0 || result.errors.length > 0;

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="p-4 rounded-lg bg-ink-50 border border-ink-100 text-sm text-ink-600 space-y-1.5">
        <p className="font-medium text-ink-700">How it works</p>
        <ol className="list-decimal list-inside space-y-1 text-ink-500">
          <li>
            <a href={templateHref} download className="text-sky-600 underline underline-offset-2 hover:text-sky-700">
              Download the CSV template
            </a>
          </li>
          <li>Fill in one row per counsellor: email + revenue</li>
          <li>Upload the file — incentives are calculated automatically</li>
        </ol>
        <p className="text-xs text-ink-400 pt-1">
          Required columns: <code className="bg-ink-100 px-1 rounded">counsellor_email</code>,{" "}
          <code className="bg-ink-100 px-1 rounded">revenue</code>
        </p>
      </div>

      {/* Upload form */}
      <form action={dispatch} className="flex items-end gap-3 flex-wrap">
        {year  && <input type="hidden" name="year"  value={year} />}
        {month && <input type="hidden" name="month" value={month} />}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-ink-500 mb-1">CSV file</label>
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm text-ink-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-ink-200 file:text-xs file:font-medium file:bg-white file:text-ink-600 hover:file:bg-ink-50 cursor-pointer"
          />
        </div>
        <Button type="submit" variant="accent" disabled={isPending}>
          {isPending ? "Importing…" : "Import"}
        </Button>
      </form>

      {/* Results */}
      {hasResult && (
        <div className="rounded-lg border border-ink-100 overflow-hidden text-sm">
          <div className="flex items-center gap-4 px-4 py-3 bg-ink-50 border-b border-ink-100">
            <span className="text-green-700 font-medium">✓ {result.imported} imported</span>
            {result.skipped > 0 && (
              <span className="text-orange-600 font-medium">⚠ {result.skipped} skipped</span>
            )}
          </div>
          {result.errors.length > 0 && (
            <ul className="divide-y divide-ink-100 max-h-40 overflow-y-auto">
              {result.errors.map((e, i) => (
                <li key={i} className="px-4 py-2 text-red-600 text-xs">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
