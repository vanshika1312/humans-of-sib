import type { HiringJobStatus } from "@/generated/prisma";

export const HIRING_JOB_STATUSES: HiringJobStatus[] = ["DRAFT", "OPEN", "ON_HOLD", "CLOSED"];

export const JOB_STATUS_LABEL: Record<HiringJobStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  ON_HOLD: "On hold",
  CLOSED: "Closed",
};

export function isJobStatus(value: string): value is HiringJobStatus {
  return (HIRING_JOB_STATUSES as string[]).includes(value);
}
