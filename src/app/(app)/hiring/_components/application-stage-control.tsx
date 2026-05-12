"use client";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { updateApplicationStage } from "../actions";

export type PipelineStageOption = { id: string; label: string };

export function ApplicationStageControl({
  applicationId,
  currentStageId,
  stages,
  returnPath,
  compact,
}: {
  applicationId: string;
  currentStageId: string;
  stages: PipelineStageOption[];
  returnPath: string;
  compact?: boolean;
}) {
  const action = updateApplicationStage.bind(null, applicationId);
  return (
    <form action={action} className={compact ? "flex flex-col gap-2 w-full" : "flex flex-wrap items-center gap-2"}>
      <input type="hidden" name="returnPath" value={returnPath} />
      <Select
        name="pipelineStageId"
        defaultValue={currentStageId}
        className={compact ? "h-9 text-sm w-full" : "h-9 min-w-[152px] text-sm"}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="outline" className={compact ? "w-full" : ""}>
        Update stage
      </Button>
    </form>
  );
}
