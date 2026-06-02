"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";
import type { HiringInterviewRound } from "@/generated/prisma";
import { HIRING_INTERVIEW_ROUNDS, roundLabel } from "@/lib/hiring-interview-rounds";
import { assignHiringApplicationReviewToRound } from "../../../actions";

function AssignSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={disabled || pending}>
      {pending ? "…" : "Link to round"}
    </Button>
  );
}

export function LegacyReviewAssignRoundForm({
  reviewId,
  returnPath,
  occupiedRounds,
}: {
  reviewId: string;
  returnPath: string;
  occupiedRounds: HiringInterviewRound[];
}) {
  const available = HIRING_INTERVIEW_ROUNDS.filter((r) => !occupiedRounds.includes(r));
  const action = assignHiringApplicationReviewToRound.bind(null, reviewId);

  if (available.length === 0) {
    return (
      <p className="text-xs text-ink-500">
        All rounds already have feedback — clear a round in the table above to link this note.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-ink-100">
      <input type="hidden" name="returnPath" value={returnPath} />
      <div className="min-w-[12rem] flex-1 sm:flex-none">
        <Label htmlFor={`assign-round-${reviewId}`} className="text-xs text-ink-500">
          Move under round
        </Label>
        <Select id={`assign-round-${reviewId}`} name="round" required className="mt-1 w-full">
          <option value="">Select round…</option>
          {available.map((r) => (
            <option key={r} value={r}>
              {roundLabel(r)}
            </option>
          ))}
        </Select>
      </div>
      <AssignSubmit disabled={false} />
    </form>
  );
}
