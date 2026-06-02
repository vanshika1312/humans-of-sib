import type { AppViewer } from "@/lib/app-viewer";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

export function canManageTrainingLibrary(me: AppViewer | null): boolean {
  if (!me) return false;
  return ADMIN_ROLES.includes(me.role) || (me.permissions ?? []).includes("ADMIN_PANEL");
}

export const MIN_QUIZ_QUESTIONS = 3;

export const TRAINING_TYPE_LABEL: Record<string, string> = {
  READING: "Book",
  EXTERNAL_COURSE: "External course",
  SELF_PACED: "Self-paced",
  LIVE: "Live",
  WORKSHOP: "Workshop",
};
