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
    <form action={submitRecruitmentDailyReport} className={cn("rounded-2xl border border-white/[0.08] bg-[#0e1015] shadow-lg overflow-hidden")}>
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.08] bg-gradient-to-r from-orange-500/14 to-transparent">
        <ClipboardList className="size-5 shrink-0 text-orange-400" aria-hidden />
        <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-orange-400">Submit daily report</h2>
      </div>

      <div className="p-5 md:p-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
          <div>
            <label
              htmlFor="report-date"
              className="block text-[10px] font-semibold uppercase tracking-wider text-white/38 mb-1.5"
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
                "w-full rounded-lg border border-white/12 bg-white/[0.06] px-3 py-2.5 text-sm text-white/90",
                "outline-none transition-[box-shadow,border-color]",
                "focus-visible:border-orange-400/70 focus-visible:ring-2 focus-visible:ring-orange-500/35",
                "[color-scheme:dark]",
              )}
            />
          </div>
          <CreatableCombo name="recruiterName" label="Recruiter" options={recruiterOptions} required />
          <CreatableCombo name="locationName" label="Location" options={locationOptions} required />
        </div>

        <p className="mt-4 text-xs text-white/40 leading-relaxed">
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
