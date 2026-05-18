"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { deleteHiringApplication } from "../actions";

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending}>
      {pending ? "…" : "Delete submission"}
    </Button>
  );
}

export function DeleteApplicationForm({ applicationId }: { applicationId: string }) {
  const action = deleteHiringApplication.bind(null, applicationId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            "Delete this submission? Attachments and reviews on this application will be removed. The candidate profile stays.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <DeleteSubmit />
    </form>
  );
}
