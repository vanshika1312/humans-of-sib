"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteHiringApplicationReview } from "../actions";

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending}>
      {pending ? "…" : "Delete feedback"}
    </Button>
  );
}

export function DeleteReviewForm({
  reviewId,
  returnPath,
}: {
  reviewId: string;
  returnPath: `/hiring${string}`;
}) {
  const action = deleteHiringApplicationReview.bind(null, reviewId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Delete this feedback? This cannot be undone (a timeline entry will be kept).")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="returnPath" value={returnPath} />
      <DeleteSubmit />
    </form>
  );
}

