"use client";

import { useState, useTransition } from "react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export type SendSummary = {
  year: number;
  month: number;
  counsellorCount: number;
  totalRevenue: number;
  totalIncentive: number;
  sentBy: string;
};

export function SendModal({
  summary,
  sendAction,
}: {
  summary: SendSummary;
  sendAction: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen]         = useState(false);
  const [sent, setSent]         = useState(false);
  const [isPending, startTrans] = useTransition();

  function handleSend() {
    startTrans(async () => {
      const fd = new FormData();
      fd.set("year",  String(summary.year));
      fd.set("month", String(summary.month));
      await sendAction(fd);
      setSent(true);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-ink-700 text-white text-sm font-medium hover:bg-ink-600 transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 8l5 5 7-7"/>
        </svg>
        Send to Accounts
      </button>

      {sent && (
        <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-green-50 border border-green-200 text-sm font-medium text-green-700">
          ✓ Sent to Accounts
        </span>
      )}

      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-9 w-full max-w-[460px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-2xl mb-5">📤</div>

            <h3 className="text-xl font-bold text-ink-700 mb-1.5">Send to Accounts Manager</h3>
            <p className="text-sm text-ink-500 mb-6 leading-relaxed">
              This will share the finalised incentive summary for{" "}
              <strong>{MONTHS[summary.month - 1]} {summary.year}</strong>.{" "}
              Ensure all figures have been reviewed before proceeding.
            </p>

            {/* Summary */}
            <div className="bg-ink-50 rounded-xl p-4 mb-6 divide-y divide-ink-100">
              {[
                { label: "Month",           val: `${MONTHS[summary.month - 1]} ${summary.year}` },
                { label: "Counsellors",     val: `${summary.counsellorCount} member${summary.counsellorCount !== 1 ? "s" : ""}` },
                { label: "Total Revenue",   val: `₹${summary.totalRevenue.toLocaleString("en-IN")}` },
                { label: "Total Incentive", val: `₹${summary.totalIncentive.toLocaleString("en-IN")}` },
                { label: "Sent by",         val: `${summary.sentBy} (Sales Head)` },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink-400">{label}</span>
                  <span className="font-semibold text-ink-700">{val}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 h-11 rounded-lg border border-ink-200 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isPending}
                className="flex-1 h-11 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <><span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</>
                ) : (
                  <>✓ Confirm &amp; Send</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
