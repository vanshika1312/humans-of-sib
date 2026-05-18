"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteClosedJobPosting } from "../actions";

function RemoveSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

export function SoftRemoveClosedJobForm({ jobId, layout }: { jobId: string; layout: "inline" | "stacked" }) {
  const action = deleteClosedJobPosting.bind(null, jobId);
  const msg =
    "Remove this closed posting from the active list?\n\nIt will appear under “Removed postings” on Job openings—you can restore it anytime.";

  return (
    <form
      action={action}
      className={layout === "stacked" ? "space-y-3 max-w-lg" : "inline"}
      onSubmit={(e) => {
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      {layout === "stacked" ? (
        <p className="text-sm text-ink-600">
          Hides this posting from careers and job lists. Applicants stay attached—you can restore from{" "}
          <strong>Removed postings</strong> if this was a mistake.
        </p>
      ) : null}
      <RemoveSubmit label={layout === "stacked" ? "Remove from listings" : "Remove"} />
    </form>
  );
}
