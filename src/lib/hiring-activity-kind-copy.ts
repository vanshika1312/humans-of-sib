import type { HiringActivityKind } from "@/generated/prisma";

export const HIRING_ACTIVITY_KIND_LABEL: Record<HiringActivityKind, string> = {
  CANDIDATE_CREATED: "Profile created",
  CANDIDATE_DUPLICATE_INTAKE: "Repeat intake (same email)",
  CANDIDATE_UPDATED: "Profile updated",
  APPLICATION_CREATED: "Attached to opening",
  APPLICATION_STAGE_CHANGED: "Pipeline stage updated",
};
