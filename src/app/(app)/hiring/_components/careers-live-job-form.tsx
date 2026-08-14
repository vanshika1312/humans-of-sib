import { Button } from "@/components/ui/button";
import { setJobListedOnCareers } from "../actions";

export function CareersLiveJobForm({
  jobId,
  listedOnCareers,
  returnTo,
  size = "sm",
}: {
  jobId: string;
  listedOnCareers: boolean;
  returnTo: "list" | "detail";
  size?: "sm" | "md";
}) {
  return (
    <form action={setJobListedOnCareers.bind(null, jobId)} className="inline">
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="live" value={listedOnCareers ? "0" : "1"} />
      <Button type="submit" variant={listedOnCareers ? "outline" : "primary"} size={size}>
        {listedOnCareers ? "Unlist from careers" : "Go live on careers"}
      </Button>
    </form>
  );
}
