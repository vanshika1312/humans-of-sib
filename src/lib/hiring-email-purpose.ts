import type { HiringEmailPurpose } from "@/generated/prisma";

export const HIRING_EMAIL_PURPOSES: HiringEmailPurpose[] = [
  "OUTREACH",
  "SHORTLISTED",
  "REJECTED",
  "OFFER",
  "INTERVIEW_INVITE",
  "OTHER",
];

export function isHiringEmailPurpose(value: string): value is HiringEmailPurpose {
  return (HIRING_EMAIL_PURPOSES as readonly string[]).includes(value);
}

export const HIRING_EMAIL_PURPOSE_LABEL: Record<HiringEmailPurpose, string> = {
  OUTREACH: "Outreach",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  OFFER: "Offer",
  INTERVIEW_INVITE: "Interview invite",
  OTHER: "Other",
};

/** Suggested order when surfacing templates on an application. */
export const HIRING_EMAIL_PURPOSE_SORT: HiringEmailPurpose[] = [
  "REJECTED",
  "SHORTLISTED",
  "OFFER",
  "INTERVIEW_INVITE",
  "OUTREACH",
  "OTHER",
];
