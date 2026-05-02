import { Check } from "lucide-react";
import type { InterviewPipelineStage } from "@/generated/prisma";
import {
  PIPELINE_STAGE_BAR_HEX,
  footerOverallToneClass,
  pipelineFooterCells,
} from "@/lib/interview-pipeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { updateInterviewPipelineCounts } from "../actions";

function stageBarPercent(count: number, screeningTotal: number): number {
  const denom = Math.max(screeningTotal, 1);
  const raw = Math.round((count / denom) * 100);
  return Math.min(100, Math.max(12, raw));
}

export function InterviewPipelineFunnel({
  stages,
  canEdit,
}: {
  stages: InterviewPipelineStage[];
  canEdit: boolean;
}) {
  const screeningTotal = stages[0]?.count ?? 0;
  const { cells, overallPct, columnCount } = pipelineFooterCells(
    stages.map((s) => ({ count: s.count })),
  );
  const totalLine = `${screeningTotal.toLocaleString("en-IN")} total candidates in pipeline`;

  const inner = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-8 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-orange-500 shadow-md shadow-orange-900/40 text-white">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
          <h3 className="text-[13px] sm:text-sm font-semibold uppercase tracking-[0.16em] text-white/92">
            Interview pipeline funnel
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-white/65 text-right max-w-[16rem]" title={totalLine}>
          {totalLine}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-10 pt-8">
        {stages.map((s) => {
          const hex = PIPELINE_STAGE_BAR_HEX[s.slug] ?? "#64748b";
          const pct = stageBarPercent(s.count, screeningTotal);

          return (
            <div key={s.id} className="flex flex-col items-stretch gap-3 min-h-[132px]">
              {canEdit ? (
                <label className="block">
                  <span className="sr-only">{s.label} count</span>
                  <input
                    name={`c_${s.id}`}
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={s.count}
                    className={cn(
                      "w-full text-center rounded-lg border border-orange-400/55 bg-black/35 px-1 py-1.5",
                      "text-2xl md:text-3xl font-bold tabular-nums text-white",
                      "outline-none focus-visible:ring-2 focus-visible:ring-orange-400/80",
                      "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                    )}
                  />
                </label>
              ) : (
                <div className="text-center text-2xl md:text-3xl font-bold tabular-nums text-white">{s.count}</div>
              )}

              <div className="mt-auto flex flex-col gap-2">
                <div className="h-4 w-full rounded-lg bg-black/35 ring-1 ring-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-[width] duration-300 ease-out"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: hex,
                      boxShadow: `0 0 20px ${hex}55`,
                    }}
                  />
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-center text-white/45 leading-tight">
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="mt-12 grid gap-x-4 gap-y-8 border-t border-white/10 pt-8"
        style={{
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        }}
      >
        {cells.map((cell, idx) => (
          <div key={`${cell.label}-${idx}`} className="text-center px-1">
            <div className={cn("text-lg font-semibold tabular-nums", cell.toneClass)}>
              {cell.pct === null ? "—" : `${cell.pct}%`}
            </div>
            <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-wider leading-snug text-white/40">
              {cell.label}
            </div>
          </div>
        ))}
        <div className="text-center px-1">
          <div className={cn("text-lg font-semibold tabular-nums", footerOverallToneClass())}>
            {overallPct === null ? "—" : `${overallPct}%`}
          </div>
          <div className="mt-2 text-[10px] sm:text-[11px] uppercase tracking-wider text-white/40">Overall</div>
        </div>
      </div>

      {canEdit && (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-black/30 px-5 py-4 ring-1 ring-white/15">
          <p className="text-xs text-white/55 max-w-xl leading-relaxed">
            Edit counts and hit save — percentages between stages and overall (joined ÷ screening) refresh automatically for
            the whole recruitment workspace.
          </p>
          <Button
            type="submit"
            className={cn(
              "shrink-0 border border-white/25 bg-white/10 text-white hover:bg-white/15",
              "focus-visible:ring-2 focus-visible:ring-orange-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2a292e]",
            )}
            variant="outline"
          >
            Save funnel
          </Button>
        </div>
      )}
    </>
  );

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_24px_50px_-30px_rgb(0_0_0/55%)] ring-1 ring-white/15 bg-[#2a292e] p-6 sm:p-8">
      {canEdit ? (
        <form action={updateInterviewPipelineCounts}>{inner}</form>
      ) : (
        inner
      )}
    </div>
  );
}
