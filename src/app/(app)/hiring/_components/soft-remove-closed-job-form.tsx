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
    "Remove this closed posting from the active list?\n\nIt will appear under “Removed postings” on Job openings. Restore reopens it in hiring (not on careers until you Go live).";

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
          Hides this posting from hiring lists and careers. Applicants stay attached—restore from{" "}
          <strong>Removed postings</strong> to reopen it in hiring.
        </p>
      ) : null}
      <RemoveSubmit label={layout === "stacked" ? "Remove from listings" : "Remove"} />
    </form>
  );
}
