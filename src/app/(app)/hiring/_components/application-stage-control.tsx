import type { HiringApplicationStage } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { HIRING_APPLICATION_STAGES, STAGE_LABEL } from "@/lib/hiring-copy";
import { updateApplicationStage } from "../actions";

export function ApplicationStageControl({
  applicationId,
  stage,
  returnPath,
  compact,
}: {
  applicationId: string;
  stage: HiringApplicationStage;
  returnPath: string;
  /** Narrow control for kanban-style cards */
  compact?: boolean;
}) {
  const action = updateApplicationStage.bind(null, applicationId);
  return (
    <form action={action} className={compact ? "flex flex-col gap-2 w-full" : "flex flex-wrap items-center gap-2"}>
      <input type="hidden" name="returnPath" value={returnPath} />
      <Select
        name="stage"
        defaultValue={stage}
        className={compact ? "h-9 text-sm w-full" : "h-9 min-w-[152px] text-sm"}
      >
        {HIRING_APPLICATION_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
          </option>
        ))}
      </Select>
      <Button type="submit" size="sm" variant="outline" className={compact ? "w-full" : ""}>
        Update stage
      </Button>
    </form>
  );
}
