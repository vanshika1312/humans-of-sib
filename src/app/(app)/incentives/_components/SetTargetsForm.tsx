"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Counsellor = {
  userId: string;
  name: string | null;
  image: string | null;
  department: string | null;
  city: string | null;
  currentTarget: number;
  currentRevenue: number;  // actual so far this month
  lastMonthRevenue: number | null; // for reference
};

export function SetTargetsForm({
  counsellors,
  year,
  month,
  saveTargetsAction,
}: {
  counsellors: Counsellor[];
  year: number;
  month: number;
  saveTargetsAction: (formData: FormData) => Promise<void>;
}) {
  const [targets, setTargets] = useState<Record<string, string>>(
    Object.fromEntries(
      counsellors.map((c) => [c.userId, c.currentTarget > 0 ? String(c.currentTarget) : ""]),
    ),
  );
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("year", String(year));
    fd.set("month", String(month));
    counsellors.forEach((c) => {
      fd.append("userId", c.userId);
      fd.append("target", targets[c.userId] || "0");
    });
    startTransition(async () => {
      await saveTargetsAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const totalTarget = counsellors.reduce(
    (a, c) => a + (Number(targets[c.userId]) || 0),
    0,
  );

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <input type="hidden" name="year"  value={year} />
      <input type="hidden" name="month" value={month} />

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 border border-sky-200">
        <span className="text-lg shrink-0">🎯</span>
        <div>
          <p className="font-semibold text-sky-700">Set Monthly Targets</p>
          <p className="text-sm text-sky-600 mt-0.5 leading-relaxed">
            Set a revenue target for each counsellor for <strong>{MONTHS[month - 1]} {year}</strong>.
            Targets are shown to each counsellor as a benchmark on their dashboard.
            Last month&apos;s actuals are shown for reference.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-ink-100 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50 border-b border-ink-100 text-[10.5px] text-ink-400 uppercase tracking-wide font-semibold">
                <th className="text-left py-3 px-5">Counsellor</th>
                <th className="text-left py-3 px-5">Cluster / Team</th>
                <th className="text-right py-3 px-5">Last Month Actual</th>
                <th className="text-right py-3 px-5">This Month So Far</th>
                <th className="text-right py-3 px-5">vs Target</th>
                <th className="text-right py-3 px-5 w-44">Target (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {counsellors.map((c) => {
                const target  = Number(targets[c.userId]) || 0;
                const pct     = target > 0 ? Math.min(100, Math.round((c.currentRevenue / target) * 100)) : null;
                const barColor = pct === null ? "bg-ink-200"
                  : pct >= 100 ? "bg-green-500"
                  : pct >= 70  ? "bg-amber-400"
                  : "bg-red-400";

                return (
                  <tr key={c.userId} className="hover:bg-ink-50/40 transition-colors">
                    <td className="py-3.5 px-5">
                      <input type="hidden" name="userId" value={c.userId} />
                      <div className="flex items-center gap-3">
                        <Avatar src={c.image} name={c.name} size="sm" />
                        <span className="font-medium text-ink-700">{c.name}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-5">
                      <div className="flex flex-col gap-0.5">
                        {c.department && (
                          <Badge tone="sky" className="text-[10px] w-fit">{c.department}</Badge>
                        )}
                        {c.city && (
                          <span className="text-xs text-ink-400">📍 {c.city}</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-right tabular-nums text-ink-500">
                      {c.lastMonthRevenue !== null && c.lastMonthRevenue > 0
                        ? `₹${c.lastMonthRevenue.toLocaleString("en-IN")}`
                        : <span className="text-ink-300">—</span>}
                    </td>

                    <td className="py-3.5 px-5 text-right tabular-nums font-medium text-ink-700">
                      {c.currentRevenue > 0
                        ? `₹${c.currentRevenue.toLocaleString("en-IN")}`
                        : <span className="text-ink-300 font-normal">—</span>}
                    </td>

                    <td className="py-3.5 px-5">
                      {pct !== null ? (
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-[5px] rounded-full bg-ink-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-ink-400 w-8 text-right tabular-nums">{pct}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-300">Set a target</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <input
                        name="target"
                        type="number"
                        min={0}
                        step={1000}
                        value={targets[c.userId] ?? ""}
                        onChange={(e) =>
                          setTargets((t) => ({ ...t, [c.userId]: e.target.value }))
                        }
                        placeholder="e.g. 500000"
                        className="w-36 h-8 text-right border border-sky-200 rounded-md px-2 text-sm bg-sky-50 focus:outline-none focus:border-sky-400 focus:bg-white transition-colors placeholder:text-ink-300"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink-200 bg-ink-50/50">
                <td colSpan={5} className="py-3 px-5 text-xs font-semibold text-ink-500">
                  Team total target · {counsellors.length} counsellor{counsellors.length !== 1 ? "s" : ""}
                </td>
                <td className="py-3 px-5 text-right text-sm font-bold text-ink-700 tabular-nums">
                  {totalTarget > 0
                    ? `₹${totalTarget.toLocaleString("en-IN")}`
                    : <span className="font-normal text-ink-300">—</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-ink-400">
          Targets are saved immediately and visible to each counsellor on their dashboard.
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="h-9 px-5 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isPending ? (
            <>
              <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : saved ? (
            <>✓ Targets saved</>
          ) : (
            <>💾 Save Targets</>
          )}
        </button>
      </div>
    </form>
  );
}
