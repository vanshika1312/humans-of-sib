import type { HiringTemplateCategory } from "@/generated/prisma";

export const HIRING_TEMPLATE_CATEGORIES: HiringTemplateCategory[] = [
  "QUESTIONNAIRE_GUIDE",
  "EMAIL",
  "JOB_POST",
  "OTHER",
];

export function isHiringTemplateCategory(value: string): value is HiringTemplateCategory {
  return (HIRING_TEMPLATE_CATEGORIES as readonly string[]).includes(value);
}

export const HIRING_TEMPLATE_CATEGORY_LABEL: Record<HiringTemplateCategory, string> = {
  QUESTIONNAIRE_GUIDE: "Questionnaire / interview guide",
  EMAIL: "Email",
  JOB_POST: "Job post",
  OTHER: "Other",
};
