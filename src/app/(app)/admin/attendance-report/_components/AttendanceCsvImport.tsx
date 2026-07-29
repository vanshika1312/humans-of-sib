"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { type AttendanceCsvImportResult, importAttendanceTestCsv } from "../actions";

const INIT: AttendanceCsvImportResult = { imported: 0, skipped: 0, errors: [] };

type Props = {
  templateHref: string;
};

export function AttendanceCsvImport({ templateHref }: Props) {
  const [result, dispatch, isPending] = useActionState(importAttendanceTestCsv, INIT);
  const hasResult = result.imported > 0 || result.skipped > 0 || result.errors.length > 0;

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-ink-50 border border-ink-100 text-sm text-ink-600 flex items-center justify-between gap-3 flex-wrap">
        <p className="font-medium text-ink-700">Import attendance (CSV)</p>
        <a href={templateHref} download className="text-sky-600 underline underline-offset-2 hover:text-sky-700">
          Download CSV template
        </a>
      </div>

      <form action={dispatch} className="space-y-3">
        <div>
          <Label htmlFor="defaultEmail" className="text-xs font-medium text-ink-500">
            Default employee email (optional)
          </Label>
          <Input
            id="defaultEmail"
            name="defaultEmail"
            type="email"
            autoComplete="off"
            placeholder="Use when every row is the same person and you omit the email column"
            className="mt-1"
          />
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-medium text-ink-500 mb-1">CSV file</label>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="block w-full text-sm text-ink-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-ink-200 file:text-xs file:font-medium file:bg-white file:text-ink-600 hover:file:bg-ink-50 cursor-pointer"
            />
          </div>
          <Button type="submit" variant="outline" disabled={isPending}>
            {isPending ? "Importing…" : "Import CSV"}
          </Button>
        </div>
      </form>

      {hasResult && (
        <div className="rounded-lg border border-ink-100 overflow-hidden text-sm">
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-ink-50 border-b border-ink-100">
            <span className="text-green-700 font-medium">✓ {result.imported} row{result.imported !== 1 ? "s" : ""} upserted</span>
            {result.skipped > 0 && (
              <span className="text-orange-600 font-medium">⚠ {result.skipped} skipped</span>
            )}
          </div>
          {result.errors.length > 0 && (
            <ul className="divide-y divide-ink-100 max-h-48 overflow-y-auto">
              {result.errors.map((e, i) => (
                <li key={i} className="px-4 py-2 text-red-600 text-xs">
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
