"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { type AttendanceCsvDeleteResult, deleteAttendanceRowsFromCsv } from "../actions";

const INIT: AttendanceCsvDeleteResult = { deleted: 0, skipped: 0, missing: 0, errors: [] };

type Props = {
  deleteTemplateHref: string;
};

export function AttendanceCsvDelete({ deleteTemplateHref }: Props) {
  const [result, dispatch, isPending] = useActionState(deleteAttendanceRowsFromCsv, INIT);
  const hasResult =
    result.deleted > 0 || result.skipped > 0 || result.missing > 0 || result.errors.length > 0;

  return (
    <div className="space-y-4 pt-8 border-t border-ink-200">
      <div className="p-4 rounded-lg bg-amber-50/80 border border-amber-200/80 text-sm text-ink-700 space-y-2">
        <p className="font-medium text-amber-950">Remove attendance rows (CSV)</p>
        <p className="text-ink-600">
          Each row deletes that <strong className="font-medium text-ink-800">employee + calendar date</strong> punch
          (the whole day), if it exists — including data from a test import, biometric sync, or check-in. This cannot be
          undone except by re-importing or re-entering the day.
        </p>
        <p className="text-ink-500 text-xs">
          <strong className="font-medium text-ink-600">Update instead:</strong> use the import CSV again with the same{" "}
          <code className="bg-white/80 px-1 rounded border border-amber-200/80">email</code> +{" "}
          <code className="bg-white/80 px-1 rounded border border-amber-200/80">date</code>; import{" "}
          <span className="font-medium text-ink-600">upserts</span> (replaces) that day.
        </p>
        <ol className="list-decimal list-inside space-y-1 text-ink-600">
          <li>
            <a
              href={deleteTemplateHref}
              download
              className="text-sky-700 underline underline-offset-2 hover:text-sky-800"
            >
              Download delete template
            </a>{" "}
            (only <code className="bg-white/80 px-1 rounded text-xs">email</code>,{" "}
            <code className="bg-white/80 px-1 rounded text-xs">date</code> columns — DD-MM-YYYY).
          </li>
          <li>Add one row per day to remove, then upload below.</li>
        </ol>
      </div>

      <form action={dispatch} className="space-y-3">
        <div>
          <Label htmlFor="deleteDefaultEmail" className="text-xs font-medium text-ink-500">
            Default employee email (optional)
          </Label>
          <Input
            id="deleteDefaultEmail"
            name="defaultEmail"
            type="email"
            autoComplete="off"
            placeholder="When every row is the same person and you omit the email column"
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
          <Button type="submit" variant="danger" disabled={isPending}>
            {isPending ? "Removing…" : "Delete rows"}
          </Button>
        </div>
      </form>

      {hasResult && (
        <div className="rounded-lg border border-ink-100 overflow-hidden text-sm">
          <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-ink-50 border-b border-ink-100">
            {result.deleted > 0 && (
              <span className="text-ink-800 font-medium">
                ✓ {result.deleted} row{result.deleted !== 1 ? "s" : ""} removed
              </span>
            )}
            {result.missing > 0 && (
              <span className="text-amber-700 font-medium">
                ○ {result.missing} row{result.missing !== 1 ? "s" : ""} had nothing to delete
              </span>
            )}
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
