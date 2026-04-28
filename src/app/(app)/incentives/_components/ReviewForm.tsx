"use client";

import { useState, useActionState, useEffect } from "react";
import { Avatar } from "@/components/ui/avatar";

export type LockBulkState = { error?: string; success?: boolean };

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Slab = { minRev: number; maxRev: number | null; rate: number };

export type ReviewRow = {
  userId: string;
  name: string | null;
  image: string | null;
  department: string | null;
  estRevenue: number;
  estIncentive: number;
  isLocked: boolean;
  adjustmentNote: string | null;
};

function computeIncentive(revenue: number, slabs: Slab[]): number {
  let rate = 0;
  for (const s of slabs) {
    if (revenue >= s.minRev && (s.maxRev === null || revenue <= s.maxRev)) {
      rate = s.rate;
    }
  }
  return Math.round((revenue * rate) / 100);
}

const initState: LockBulkState = {};

export function ReviewForm({
  rows: initialRows,
  slabs,
  year,
  month,
  periodSheetUrl,
  periodNote,
  allLocked,
  lockAction,
}: {
  rows: ReviewRow[];
  slabs: Slab[];
  year: number;
  month: number;
  periodSheetUrl: string | null;
  periodNote: string | null;
  allLocked: boolean;
  lockAction: (state: LockBulkState, formData: FormData) => Promise<LockBulkState>;
}) {
  const [revenues, setRevenues] = useState<Record<string, number>>(
    Object.fromEntries(initialRows.map((r) => [r.userId, r.estRevenue])),
  );
  const [notes, setNotes] = useState<Record<string, string>>(
    Object.fromEntries(initialRows.map((r) => [r.userId, r.adjustmentNote ?? ""])),
  );
  const [locked, setLocked] = useState(allLocked);
  const [state, formAction, isPending] = useActionState(lockAction, initState);

  useEffect(() => {
    if (state?.success) setLocked(true);
  }, [state?.success]);

  const estTotal = initialRows.reduce((a, r) => a + r.estIncentive, 0);
  const finalTotal = initialRows.reduce((a, r) => {
    const rev = revenues[r.userId] ?? r.estRevenue;
    return a + computeIncentive(rev, slabs);
  }, 0);
  const netAdj = finalTotal - estTotal;

  function reset() {
    setRevenues(Object.fromEntries(initialRows.map((r) => [r.userId, r.estRevenue])));
    setNotes(Object.fromEntries(initialRows.map((r) => [r.userId, r.adjustmentNote ?? ""])));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="year"  value={year} />
      <input type="hidden" name="month" value={month} />

      {/* Status banner */}
      {locked ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-sm font-medium text-green-700">
          <span className="text-base">🔒</span>
          Sheet locked for {MONTHS[month - 1]} {year} — figures are finalised. The Accounts Manager can now approve.
          {periodSheetUrl && (
            <a href={periodSheetUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-sky-600 underline text-xs">{periodNote || "Sales sheet"} ↗</a>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <span className="text-lg shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold text-amber-700">Review Before Locking</p>
            <p className="text-sm text-amber-600 mt-0.5 leading-relaxed">
              Adjust any figures that need correction (refunds, cancellations, data errors). Add a note for each change. Once locked, figures are frozen for payout.
            </p>
          </div>
          {periodSheetUrl && (
            <a href={periodSheetUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sky-600 text-xs underline">
              Open sales sheet ↗
            </a>
          )}
        </div>
      )}

      {/* Adjustment table */}
      <div className="bg-white border border-ink-100 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100">
          <h2 className="font-semibold text-ink-700">Final Adjustment Sheet</h2>
          <p className="text-xs text-ink-400 mt-0.5">
            {MONTHS[month - 1]} {year} · Edit revenue figures — incentive recalculates automatically
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 border-b border-ink-100 text-[10.5px] text-ink-400 uppercase tracking-wide font-semibold">
                <th className="text-left py-3 px-5">Counsellor</th>
                <th className="text-right py-3 px-5">Est. Revenue</th>
                <th className="text-right py-3 px-5">Final Revenue</th>
                <th className="text-right py-3 px-5">Est. Incentive</th>
                <th className="text-right py-3 px-5">Final Incentive</th>
                <th className="text-right py-3 px-5">Difference</th>
                <th className="py-3 px-5">Reason / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {initialRows.map((row) => {
                const rev      = revenues[row.userId] ?? row.estRevenue;
                const finalInc = computeIncentive(rev, slabs);
                const diff     = finalInc - row.estIncentive;
                const rowLocked = locked || row.isLocked;

                return (
                  <tr key={row.userId} className="hover:bg-ink-50/40 transition-colors">
                    <td className="py-3 px-5">
                      {/* Hidden form inputs per row — must be inside a cell */}
                      <input type="hidden" name="userId" value={row.userId} />
                      <div className="flex items-center gap-3">
                        <Avatar src={row.image} name={row.name} size="sm" />
                        <div>
                          <div className="font-medium text-ink-700">{row.name}</div>
                          {row.department && <div className="text-xs text-ink-400">{row.department}</div>}
                        </div>
                      </div>
                    </td>

                    {/* Est. Revenue */}
                    <td className="py-3 px-5 text-right text-ink-400 tabular-nums">
                      {row.estRevenue > 0 ? `₹${row.estRevenue.toLocaleString("en-IN")}` : <span className="text-ink-300">—</span>}
                    </td>

                    {/* Final Revenue (editable) */}
                    <td className="py-3 px-5 text-right">
                      <input
                        name="revenue"
                        type="number"
                        min={0}
                        value={rev}
                        onChange={(e) => setRevenues((r) => ({ ...r, [row.userId]: Number(e.target.value) || 0 }))}
                        disabled={rowLocked}
                        className="w-28 h-8 text-right border border-ink-200 rounded-md px-2 text-sm bg-ink-50 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors disabled:opacity-40 disabled:bg-ink-50"
                      />
                    </td>

                    {/* Est. Incentive */}
                    <td className="py-3 px-5 text-right text-ink-400 tabular-nums">
                      {row.estIncentive > 0 ? `₹${row.estIncentive.toLocaleString("en-IN")}` : <span className="text-ink-300">—</span>}
                    </td>

                    {/* Final Incentive (computed) */}
                    <td className="py-3 px-5 text-right font-semibold text-ink-700 tabular-nums">
                      {finalInc > 0 ? `₹${finalInc.toLocaleString("en-IN")}` : <span className="text-ink-300 font-normal">—</span>}
                    </td>

                    {/* Difference */}
                    <td className="py-3 px-5 text-right">
                      {diff === 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-ink-50 text-ink-400 font-medium">—</span>
                      ) : diff > 0 ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 font-semibold">
                          +₹{diff.toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600 font-semibold">
                          −₹{Math.abs(diff).toLocaleString("en-IN")}
                        </span>
                      )}
                    </td>

                    {/* Reason / Note */}
                    <td className="py-3 px-5">
                      <input
                        name="note"
                        type="text"
                        value={notes[row.userId] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [row.userId]: e.target.value }))}
                        disabled={rowLocked}
                        placeholder="Reason for change…"
                        className="w-40 h-8 border border-ink-200 rounded-md px-2 text-sm bg-ink-50 focus:outline-none focus:border-orange-400 focus:bg-white transition-colors disabled:opacity-40 placeholder:text-ink-300"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review summary + lock actions */}
      <div className="bg-white border border-ink-100 rounded-xl p-5 flex items-center gap-8 flex-wrap">
        <div className="text-center min-w-[100px]">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide font-medium mb-1">Estimated Total</div>
          <div className="text-2xl font-bold text-ink-700 tabular-nums">₹{estTotal.toLocaleString("en-IN")}</div>
        </div>
        <div className="w-px h-10 bg-ink-100 hidden sm:block" />
        <div className="text-center min-w-[100px]">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide font-medium mb-1">Final Total</div>
          <div className="text-2xl font-bold text-ink-700 tabular-nums">₹{finalTotal.toLocaleString("en-IN")}</div>
        </div>
        <div className="w-px h-10 bg-ink-100 hidden sm:block" />
        <div className="text-center min-w-[100px]">
          <div className="text-[10px] text-ink-400 uppercase tracking-wide font-medium mb-1">Net Adjustment</div>
          <div className={`text-2xl font-bold tabular-nums ${netAdj > 0 ? "text-green-600" : netAdj < 0 ? "text-red-600" : "text-ink-400"}`}>
            {netAdj === 0 ? "₹0" : `${netAdj > 0 ? "+" : "−"}₹${Math.abs(netAdj).toLocaleString("en-IN")}`}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!locked ? (
            <>
              <button
                type="button"
                onClick={reset}
                className="h-9 px-4 rounded-lg border border-ink-200 text-sm font-medium text-ink-600 hover:bg-ink-50 transition-colors"
              >
                ↺ Reset
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="h-9 px-5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPending ? (
                  <><span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                ) : (
                  <>🔒 Lock &amp; Finalise</>
                )}
              </button>
            </>
          ) : (
            <span className="h-9 px-4 rounded-lg bg-green-50 border border-green-200 text-sm font-medium text-green-700 flex items-center gap-1.5">
              ✓ Locked &amp; Finalised
            </span>
          )}
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600 mt-2">{state.error}</p>
      )}
    </form>
  );
}
