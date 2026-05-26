import type { HiringJobWorkArrangement } from "@/generated/prisma";

const WORK_ARRANGEMENTS: HiringJobWorkArrangement[] = ["ON_SITE", "REMOTE", "HYBRID"];

export type HiringJobTemplateFieldsV1 = {
  v: 1;
  description?: string;
  skillsRequired?: string;
  experienceRequired?: string;
  employmentType?: string;
  workArrangement?: HiringJobWorkArrangement;
  location?: string;
  salaryRange?: string;
};

export function isHiringJobWorkArrangement(value: string): value is HiringJobWorkArrangement {
  return (WORK_ARRANGEMENTS as readonly string[]).includes(value);
}

export function parseHiringJobTemplateFields(json: string | null | undefined): HiringJobTemplateFieldsV1 | null {
  if (!json?.trim()) return null;
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object" || (raw as { v?: number }).v !== 1) return null;
    const o = raw as Record<string, unknown>;
    const out: HiringJobTemplateFieldsV1 = { v: 1 };

    if (typeof o.description === "string" && o.description.trim()) out.description = o.description.trim();
    if (typeof o.skillsRequired === "string" && o.skillsRequired.trim()) out.skillsRequired = o.skillsRequired.trim();
    if (typeof o.experienceRequired === "string" && o.experienceRequired.trim()) {
      out.experienceRequired = o.experienceRequired.trim();
    }
    if (typeof o.employmentType === "string" && o.employmentType.trim()) {
      out.employmentType = o.employmentType.trim().slice(0, 80);
    }
    if (typeof o.location === "string" && o.location.trim()) out.location = o.location.trim().slice(0, 200);
    if (typeof o.salaryRange === "string" && o.salaryRange.trim()) out.salaryRange = o.salaryRange.trim().slice(0, 120);
    if (typeof o.workArrangement === "string" && isHiringJobWorkArrangement(o.workArrangement)) {
      out.workArrangement = o.workArrangement;
    }

    const hasContent =
      out.description ||
      out.skillsRequired ||
      out.experienceRequired ||
      out.employmentType ||
      out.workArrangement ||
      out.location ||
      out.salaryRange;
    return hasContent ? out : null;
  } catch {
    return null;
  }
}

export function buildHiringJobTemplateFieldsFromForm(formData: FormData): HiringJobTemplateFieldsV1 | null {
  const description = String(formData.get("jobDescription") ?? formData.get("description") ?? "").trim();
  const skillsRequired = String(formData.get("jobSkillsRequired") ?? formData.get("skillsRequired") ?? "").trim();
  const experienceRequired = String(formData.get("jobExperienceRequired") ?? formData.get("experienceRequired") ?? "").trim();
  const employmentType = String(formData.get("jobEmploymentType") ?? formData.get("employmentType") ?? "").trim();
  const location = String(formData.get("jobLocation") ?? formData.get("location") ?? "").trim();
  const salaryRange = String(formData.get("jobSalaryRange") ?? formData.get("salaryRange") ?? "").trim();
  const workArrangementRaw = String(formData.get("jobWorkArrangement") ?? formData.get("workArrangement") ?? "").trim();

  const fields: HiringJobTemplateFieldsV1 = { v: 1 };
  if (description) fields.description = description;
  if (skillsRequired) fields.skillsRequired = skillsRequired;
  if (experienceRequired) fields.experienceRequired = experienceRequired;
  if (employmentType) fields.employmentType = employmentType.slice(0, 80);
  if (location) fields.location = location.slice(0, 200);
  if (salaryRange) fields.salaryRange = salaryRange.slice(0, 120);
  if (workArrangementRaw && isHiringJobWorkArrangement(workArrangementRaw)) {
    fields.workArrangement = workArrangementRaw;
  }

  return parseHiringJobTemplateFields(JSON.stringify(fields));
}

export function serializeHiringJobTemplateFields(fields: HiringJobTemplateFieldsV1): string {
  return JSON.stringify(fields);
}

/** Preview text for template lists — description or first available field. */
export function jobTemplatePreviewText(body: string, jobFieldsJson: string | null | undefined): string {
  const parsed = parseHiringJobTemplateFields(jobFieldsJson);
  if (parsed?.description) return parsed.description.slice(0, 280);
  if (body.trim()) return body.trim().slice(0, 280);
  if (parsed?.skillsRequired) return parsed.skillsRequired.slice(0, 280);
  return "";
}
