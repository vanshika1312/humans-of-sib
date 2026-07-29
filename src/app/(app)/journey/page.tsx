import { Suspense } from "react";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { loadEmployeeJourney } from "./_data/load-employee-journey";
import { MyJourney } from "./_components/MyJourney";

export default function JourneyPage() {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <JourneyPageBody />
    </Suspense>
  );
}

async function JourneyPageBody() {
  const viewer = await requireAppViewer();
  if (!viewer) return null;

  const data = await loadEmployeeJourney(viewer);

  return <MyJourney data={data} />;
}
