import type { HiringApplicationStage, HiringJobStatus } from "@/generated/prisma";

export const HIRING_JOB_STATUSES: HiringJobStatus[] = ["DRAFT", "OPEN", "ON_HOLD", "CLOSED"];

export const JOB_STATUS_LABEL: Record<HiringJobStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
};

export const HIRING_APPLICATION_STAGES: HiringApplicationStage[] = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "OFFER",
  "HIRED",
  "REJECTED",
];

export const STAGE_LABEL: Record<HiringApplicationStage, string> = {
  APPLIED: "Applied",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export function isJobStatus(value: string): value is HiringJobStatus {
  return (HIRING_JOB_STATUSES as string[]).includes(value);
}

export function isApplicationStage(value: string): value is HiringApplicationStage {
  return (HIRING_APPLICATION_STAGES as string[]).includes(value);
}
