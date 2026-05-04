"use client";

import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CreatableCombo } from "./creatable-combo";
import { submitRecruitmentDailyReport } from "../actions";

export function DailyReportForm({
  recruiterOptions,
  locationOptions,
  defaultReportDate,
}: {
  recruiterOptions: string[];
  locationOptions: string[];
  /** yyyy-mm-dd */
  defaultReportDate: string;
}) {
  return (
    <form
      action={submitRecruitmentDailyReport}
      className={cn(
        "rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden",
      )}
    >
      <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-100 bg-orange-50/70">
        <ClipboardList className="size-5 shrink-0 text-orange-600" aria-hidden />
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-orange-700">Submit daily report</h2>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
          <div>
            <label
              htmlFor="report-date"
              className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1.5"
            >
              Date
            </label>
            <input
              id="report-date"
              name="reportDate"
              type="date"
              required
              defaultValue={defaultReportDate}
              className={cn(
                "w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800",
                "outline-none transition-[box-shadow,border-color]",
                "focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25",
              )}
            />
          </div>
          <CreatableCombo name="recruiterName" label="Recruiter" options={recruiterOptions} required />
          <CreatableCombo name="locationName" label="Location" options={locationOptions} required />
        </div>

        <p className="mt-4 text-xs text-ink-500 leading-relaxed">
          Pick a suggested value from the list or type a new recruiter or location — both fields accept custom text.
        </p>

        <div className="mt-6 flex justify-end">
          <Button type="submit" variant="accent">
            Submit report
          </Button>
        </div>
      </div>
    </form>
  );
}
