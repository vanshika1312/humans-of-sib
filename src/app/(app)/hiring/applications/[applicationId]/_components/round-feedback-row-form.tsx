import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import type { HiringInterviewRound } from "@/generated/prisma";
import { roundLabel } from "@/lib/hiring-interview-rounds";
import {
  clearHiringApplicationRoundFeedback,
  upsertHiringApplicationRoundFeedback,
} from "../../../actions";
import {
  RoundInterviewerField,
  type InterviewerOption,
} from "./round-interviewer-field";

export type RoundFeedbackInitial = {
  rating: number | null;
  comment: string;
  interviewerUserId: string | null;
  interviewerName: string | null;
  updatedAt: Date | null;
};

const ROW_GRID =
  "grid grid-cols-1 gap-4 border-t border-ink-100 p-4 first:border-t-0 sm:grid-cols-[minmax(7.5rem,auto)_minmax(11rem,1fr)_5.5rem_minmax(12rem,1fr)_auto] sm:items-start sm:gap-x-4 sm:gap-y-3";

export function RoundFeedbackRowForm({
  applicationId,
  round,
  returnPath,
  interviewerOptions,
  initial,
}: {
  applicationId: string;
  round: HiringInterviewRound;
  returnPath: string;
  interviewerOptions: InterviewerOption[];
  initial: RoundFeedbackInitial | null;
}) {
  const label = roundLabel(round);
  const hasSaved = Boolean(initial);
  const defaultUserId = initial?.interviewerUserId ?? "";
  const defaultName = initial?.interviewerName ?? "";
  const ratingDefault =
    initial?.rating === null || initial?.rating === undefined ? "" : String(initial.rating);

  const upsertAction = upsertHiringApplicationRoundFeedback.bind(null, applicationId, round);
  const clearAction = clearHiringApplicationRoundFeedback.bind(null, applicationId, round);

  return (
    <form action={upsertAction} className={ROW_GRID}>
      <input type="hidden" name="returnPath" value={returnPath} />

      <div className="sm:pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 sm:sr-only">Round</p>
        <p className="font-medium text-ink-800 text-sm whitespace-nowrap">{label}</p>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 mb-1.5 sm:sr-only">
          Interviewer
        </p>
        <RoundInterviewerField
          options={interviewerOptions}
          defaultUserId={defaultUserId}
          defaultName={defaultName}
          inputId={`interviewer-${round}`}
        />
      </div>

      <div>
        <Label htmlFor={`rating-${round}`} className="text-[10px] uppercase tracking-wider text-ink-400 sm:sr-only">
          Rating
        </Label>
        <Select id={`rating-${round}`} name="rating" className="w-full" defaultValue={ratingDefault}>
          <option value="">—</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>
              {n}
            </option>
          ))}
        </Select>
      </div>

      <div className="sm:col-span-1">
        <Label htmlFor={`comment-${round}`} className="text-[10px] uppercase tracking-wider text-ink-400 sm:sr-only">
          Feedback
        </Label>
        <Textarea
          id={`comment-${round}`}
          name="comment"
          rows={3}
          className="w-full min-h-[4.5rem]"
          placeholder="Panel notes, strengths, concerns…"
          defaultValue={initial?.comment ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2 sm:items-end sm:pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 sm:sr-only">Actions</p>
        <Button type="submit" variant="accent" size="sm" className="w-full sm:w-auto">
          Save
        </Button>
        {hasSaved ? (
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full sm:w-auto text-ink-500"
            formAction={clearAction}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </form>
  );
}
