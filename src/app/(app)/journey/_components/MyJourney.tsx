"use client";

import { mockEmployeeJourney } from "../_data/mockEmployeeData";
import { PageHeader } from "@/components/ui/page-header";
import { JourneyHeader } from "./JourneyHeader";
import { StatsRibbon } from "./StatsRibbon";
import { GrowthGraph } from "./GrowthGraph";
import { Timeline } from "./Timeline";
import { CertificationsGallery } from "./CertificationsGallery";
import { AwardsWall } from "./AwardsWall";
import { ExportButton } from "./ExportButton";
import { TaggedMomentsLine } from "./TaggedMomentsLine";

export function MyJourney() {
  const data = mockEmployeeJourney;

  return (
    <div className="w-full space-y-6 pb-8">
      <PageHeader
        title="My Journey"
        emoji="🧭"
        subtitle="Your story at SIB — growth, milestones, and moments worth remembering."
        action={<ExportButton data={data} />}
      />

      <TaggedMomentsLine photos={data.taggedFeedPhotos} />
      <JourneyHeader employee={data.employee} />
      <StatsRibbon stats={data.stats} />
      <GrowthGraph
        growthCurve={data.growthCurve}
        seniorityLabels={data.seniorityLabels}
      />
      <Timeline milestones={data.milestones} />
      <CertificationsGallery certifications={data.certifications} />
      <AwardsWall awards={data.awards} />
    </div>
  );
}
