import { Check } from "lucide-react";
import type { RecruitmentFunnelStage } from "@/generated/prisma";
import {
  FUNNEL_STAGE_HEX,
  funnelFooterCells,
  funnelOverallToneClass,
} from "@/lib/recruitment-funnel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { updateRecruitmentFunnelCounts } from "../actions";

function stageBarPercent(count: number, screeningTotal: number): number {
  const denom = Math.max(screeningTotal, 1);
  const raw = Math.round((count / denom) * 100);
  return Math.min(100, Math.max(12, raw));
}

/** Bar funnel (screening → joined) — counts come from Workspace Admin–editable headline data */
export function RecruitmentFunnel({
  barStages,
  headlineTotalCount,
  canEdit,
}: {
  /** screening → joined in order */
  barStages: RecruitmentFunnelStage[];
  headlineTotalCount: number;
  canEdit: boolean;
}) {
  const screeningTotal = barStages.find((s) => s.slug === "screening")?.count ?? 0;
  const { cells, overallPct, columnCount } = funnelFooterCells(barStages.map((s) => ({ count: s.count })));
  const totalLine =
    headlineTotalCount > 0
      ? `${headlineTotalCount.toLocaleString("en-IN")} TOTAL (headline) · ${screeningTotal.toLocaleString("en-IN")} SCREENING cohort`
      : `${screeningTotal.toLocaleString("en-IN")} at screening`;

  const inner = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-8 border-b border-ink-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-orange-500 text-white shadow-sm ring-1 ring-orange-600/20">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
          <div>
            <h3 className="text-[13px] sm:text-sm font-semibold uppercase tracking-[0.16em] text-ink-700">
              Hiring funnel
            </h3>
            <p className="text-[10px] sm:text-[11px] text-ink-400 mt-0.5 tracking-wide">Recruitment · internal view</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-ink-500 text-right max-w-[20rem]" title={totalLine}>
          {totalLine}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-10 pt-8">
        {barStages.map((s) => {
          const hex = FUNNEL_STAGE_HEX[s.slug] ?? "#64748b";
          const pct = stageBarPercent(s.count, screeningTotal);

          return (
            <div key={s.id} className="flex flex-col items-stretch gap-3 min-h-[132px]">
              {canEdit ? (
                <label className="block">
                  <span className="sr-only">{s.label}</span>
                  <input
                    name={`c_${s.id}`}
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={s.count}
                    className={cn(
                      "w-full text-center rounded-lg border border-ink-200 bg-white px-1 py-1.5",
                      "text-2xl md:text-3xl font-bold tabular-nums text-ink-800",
                      "outline-none focus-visible:ring-2 focus-visible:ring-sky-500/45 focus-visible:border-sky-400",
                      "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                    )}
                  />
                </label>
              ) : (
                <div className="text-center text-2xl md:text-3xl font-bold tabular-nums text-ink-800">{s.count}</div>
              )}

              <div className="mt-auto flex flex-col gap-2">
                <div className="h-4 w-full rounded-lg bg-ink-100 ring-1 ring-ink-200/80 overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-[width] duration-300 ease-out"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: hex,
                      boxShadow: `0 0 14px ${hex}44`,
                    }}
                  />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-center text-ink-400 leading-tight">
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-12 grid gap-x-4 gap-y-8 border-t border-ink-100 pt-8"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((cell, idx) => (
          <div key={`${cell.label}-${idx}`} className="text-center px-1">
            <div className={cn("text-lg font-semibold tabular-nums", cell.toneClass)}>
              {cell.pct === null ? "—" : `${cell.pct}%`}
            </div>
            <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-wider leading-snug text-ink-400">
              {cell.label}
            </div>
          </div>
        ))}
        <div className="text-center px-1">
          <div className={cn("text-lg font-semibold tabular-nums", funnelOverallToneClass())}>
            {overallPct === null ? "—" : `${overallPct}%`}
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-wider text-ink-400">Overall</div>
        </div>
      </div>

      {canEdit && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-100 bg-ink-50/60 px-5 py-4">
          <p className="text-xs text-ink-500 max-w-xl leading-relaxed">
            Workspace Admin or CEO edits — percentages use the SCREENING cohort. Use <strong>TOTAL</strong> in headline
            strip for headline pipeline size.
          </p>
          <Button type="submit" variant="outline" className="shrink-0">
            Save funnel bars
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className="rounded-2xl border border-ink-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-6 sm:p-8">
      {canEdit ? (
        <form action={updateRecruitmentFunnelCounts}>{inner}</form>
      ) : (
        inner
      )}
    </div>
  );
}
