import type { RecruitmentFunnelStage } from "@/generated/prisma";
import { METRIC_STRIP_HEX } from "@/lib/recruitment-funnel";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { updateRecruitmentFunnelCounts } from "../actions";

function displayValue(stage: RecruitmentFunnelStage): string {
  if (stage.slug === "offer_rate_pct") return `${stage.count}%`;
  return stage.count.toLocaleString("en-IN");
}

export function RecruitmentMetricStrip({
  stages,
  canEdit,
}: {
  stages: RecruitmentFunnelStage[];
  canEdit: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_20px_40px_-28px_rgb(0_0_0/50%)] ring-1 ring-white/12 bg-[#141824] px-4 py-5 sm:px-6">
      {!canEdit && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
          <Shield className="size-3.5 shrink-0 opacity-70" aria-hidden />
          Headline metrics are view-only — only Workspace Admin / CEO can change these numbers or the funnel below.
        </p>
      )}

      {canEdit ? (
        <form action={updateRecruitmentFunnelCounts}>
          <StripInner stages={stages} canEdit />
          <div className="mt-5 flex justify-end">
            <Button
              type="submit"
              className={cn(
                "border border-white/22 bg-white/10 text-white hover:bg-white/[0.14]",
                "focus-visible:ring-2 focus-visible:ring-orange-400/80",
              )}
              variant="outline"
              size="sm"
            >
              Save headline metrics
            </Button>
          </div>
        </form>
      ) : (
        <StripInner stages={stages} canEdit={false} />
      )}
    </div>
  );
}

function StripInner({ stages, canEdit }: { stages: RecruitmentFunnelStage[]; canEdit: boolean }) {
  return (
    <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin [scrollbar-color:rgba(255,255,255,0.22)_transparent] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-1.5">
      {stages.map((stage) => {
        const hex = METRIC_STRIP_HEX[stage.slug] ?? "#e5e7eb";

        return (
          <div
            key={stage.id}
            className="snap-start shrink-0 min-w-[6.75rem] sm:min-w-[7rem] rounded-xl bg-black/25 px-3 py-4 ring-1 ring-white/18"
          >
            {canEdit ? (
              <>
                <label className="block cursor-text">
                  <span className="sr-only">{stage.label}</span>
                  {stage.slug === "offer_rate_pct" ? (
                    <div className="flex items-baseline justify-center gap-px">
                      <input
                        name={`c_${stage.id}`}
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        defaultValue={stage.count}
                        className={cn(
                          "min-w-[2.5ch] max-w-[4.5ch] bg-transparent border-0 p-0 text-right text-2xl sm:text-[1.65rem] font-bold tabular-nums outline-none",
                          "focus-visible:ring-2 focus-visible:ring-orange-400/70 rounded-md",
                          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                        )}
                        style={{ color: hex }}
                      />
                      <span
                        className="text-2xl sm:text-[1.65rem] font-bold tabular-nums shrink-0 pl-px"
                        style={{ color: hex }}
                      >
                        %
                      </span>
                    </div>
                  ) : (
                    <input
                      name={`c_${stage.id}`}
                      type="number"
                      min={0}
                      step={1}
                      defaultValue={stage.count}
                      className={cn(
                        "w-full bg-transparent border-0 p-0 text-center text-2xl sm:text-[1.65rem] font-bold tabular-nums outline-none",
                        "focus-visible:ring-2 focus-visible:ring-orange-400/70 rounded-md",
                        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                      )}
                      style={{ color: hex }}
                    />
                  )}
                </label>
              </>
            ) : (
              <div
                className="text-center text-2xl sm:text-[1.65rem] font-bold tabular-nums leading-none"
                style={{ color: hex }}
              >
                {displayValue(stage)}
              </div>
            )}

            <div className="mt-2.5 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/52 leading-tight">
              {stage.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
