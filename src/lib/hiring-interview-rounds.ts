import type { HiringInterviewRound } from "@/generated/prisma";

export const HIRING_INTERVIEW_ROUNDS: HiringInterviewRound[] = [
  "SCREENING",
  "FIRST_VIRTUAL",
  "SECOND_ROUND",
  "FINAL_ROUND",
];

const ROUND_LABELS: Record<HiringInterviewRound, string> = {
  SCREENING: "Screening",
  FIRST_VIRTUAL: "1st virtual round",
  SECOND_ROUND: "2nd round",
  FINAL_ROUND: "Final round",
};

export function roundLabel(round: HiringInterviewRound): string {
  return ROUND_LABELS[round];
}

export function isHiringInterviewRound(value: string): value is HiringInterviewRound {
  return (HIRING_INTERVIEW_ROUNDS as string[]).includes(value);
}
