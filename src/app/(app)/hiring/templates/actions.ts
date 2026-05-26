"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { HiringEmailPurpose, HiringTemplateCategory } from "@/generated/prisma";

import { isHiringEmailPurpose } from "@/lib/hiring-email-purpose";
import { buildHiringJobTemplateFieldsFromForm, serializeHiringJobTemplateFields } from "@/lib/hiring-job-template-fields";
import { isHiringTemplateCategory } from "@/lib/hiring-template-category";

const HR_GATE = ["CEO", "ADMIN", "HR"];

const templatesPathQuery = "/hiring/templates";

async function requireHiringTemplateUser() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !HR_GATE.includes(me.role)) redirect("/home");
  return me;
}

function redirectWithError(msg: string, tab?: string) {
  const q = new URLSearchParams({ error: msg });
  if (tab) q.set("tab", tab);
  redirect(`${templatesPathQuery}?${q.toString()}`);
}

type ParsedTemplate = {
  category: HiringTemplateCategory;
  title: string;
  body: string;
  pipelineStageId: string | null;
  sortOrder: number;
  subject: string | null;
  emailPurpose: HiringEmailPurpose | null;
  jobFieldsJson: string | null;
};

function parseSortOrder(formData: FormData): number {
  const raw = String(formData.get("sortOrder") ?? "0").trim();
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, n));
}

function parseTemplateFormData(formData: FormData): ParsedTemplate | { error: string; tab: string } {
  const tab = String(formData.get("tab") || "").trim() || "questionnaire";

  const categoryRaw = String(formData.get("category") || "").trim();
  if (!isHiringTemplateCategory(categoryRaw)) {
    return { error: "Pick a template type.", tab };
  }
  const category = categoryRaw as HiringTemplateCategory;

  const title = String(formData.get("title") || "").trim().slice(0, 200);
  if (!title) return { error: "Add a title.", tab };

  const sortOrder = parseSortOrder(formData);
  let pipelineStageId: string | null = null;
  let subject: string | null = null;
  let emailPurpose: ParsedTemplate["emailPurpose"] = null;
  let jobFieldsJson: string | null = null;
  let body = "";

  if (category === "QUESTIONNAIRE_GUIDE") {
    const pipelineStageRaw = String(formData.get("pipelineStageId") || "").trim();
    if (!pipelineStageRaw) return { error: "Questionnaire templates must map to a funnel stage.", tab: "questionnaire" };
    body = String(formData.get("body") || "").trim();
    if (body.length < 10) return { error: "Add at least a few lines of questionnaire content.", tab: "questionnaire" };
    return {
      category,
      title,
      body,
      pipelineStageId: pipelineStageRaw,
      sortOrder,
      subject: null,
      emailPurpose: null,
      jobFieldsJson: null,
    };
  }

  if (category === "EMAIL") {
    subject = String(formData.get("subject") || "").trim().slice(0, 500);
    if (!subject) return { error: "Email templates need a subject line.", tab: "email" };
    const purposeRaw = String(formData.get("emailPurpose") || "").trim();
    if (!isHiringEmailPurpose(purposeRaw)) {
      return { error: "Pick an email purpose (shortlisted, rejected, etc.).", tab: "email" };
    }
    emailPurpose = purposeRaw;
    body = String(formData.get("body") || "").trim();
    if (body.length < 10) return { error: "Add at least a few lines of email body.", tab: "email" };
    return {
      category,
      title,
      body,
      pipelineStageId: null,
      sortOrder,
      subject,
      emailPurpose,
      jobFieldsJson: null,
    };
  }

  if (category === "JOB_POST") {
    const fields = buildHiringJobTemplateFieldsFromForm(formData);
    if (!fields) {
      return {
        error: "Job profile templates need at least one reusable field (description, skills, etc.).",
        tab: "job",
      };
    }
    jobFieldsJson = serializeHiringJobTemplateFields(fields);
    body = fields.description ?? fields.skillsRequired?.slice(0, 500) ?? title;
    return {
      category,
      title,
      body,
      pipelineStageId: null,
      sortOrder,
      subject: null,
      emailPurpose: null,
      jobFieldsJson,
    };
  }

  body = String(formData.get("body") || "").trim();
  if (body.length < 10) return { error: "Add at least a few lines of content.", tab };
  return {
    category,
    title,
    body,
    pipelineStageId: null,
    sortOrder,
    subject: null,
    emailPurpose: null,
    jobFieldsJson: null,
  };
}

function unwrapParsed(parsed: ParsedTemplate | { error: string; tab: string }): ParsedTemplate {
  if ("error" in parsed) redirectWithError(parsed.error, parsed.tab);
  return parsed;
}

async function resolvePipelineStageId(
  category: HiringTemplateCategory,
  pipelineStageId: string | null,
): Promise<string | null> {
  if (category !== "QUESTIONNAIRE_GUIDE" || !pipelineStageId) return null;
  const exists = await prisma.hiringPipelineStage.findUnique({
    where: { id: pipelineStageId },
    select: { id: true },
  });
  return exists?.id ?? null;
}

export async function createHiringTemplate(formData: FormData) {
  const me = await requireHiringTemplateUser();
  const parsed = unwrapParsed(parseTemplateFormData(formData));

  const pipelineStageId = await resolvePipelineStageId(parsed.category, parsed.pipelineStageId);
  if (parsed.category === "QUESTIONNAIRE_GUIDE" && !pipelineStageId) {
    redirectWithError("Pick a funnel stage from the list.", "questionnaire");
  }

  if (parsed.body.length > 16000) redirectWithError("Template is too long (max 16k characters).", String(formData.get("tab") || ""));

  const created = await prisma.hiringInterviewQuestionTemplate.create({
    data: {
      category: parsed.category,
      pipelineStageId,
      title: parsed.title,
      body: parsed.body,
      sortOrder: parsed.sortOrder,
      subject: parsed.subject,
      emailPurpose: parsed.emailPurpose,
      jobFieldsJson: parsed.jobFieldsJson,
      createdById: me.id,
    },
  });

  await prisma.hiringActivity.create({
    data: {
      kind: "HIRING_TEMPLATE_CREATED",
      summary: `Template created: ${parsed.title}`,
      payloadJson: JSON.stringify({
        templateId: created.id,
        category: parsed.category,
        title: parsed.title,
        emailPurpose: parsed.emailPurpose,
        hasJobFields: Boolean(parsed.jobFieldsJson),
      }),
      actorUserId: me.id,
    },
  });

  const tab = parsed.category === "JOB_POST" ? "job" : parsed.category === "EMAIL" ? "email" : "questionnaire";
  revalidatePath("/hiring/templates");
  revalidatePath("/hiring/applications", "layout");
  revalidatePath("/hiring/jobs/new");
  revalidatePath("/hiring");
  revalidatePath("/hiring/activity");
  redirect(`${templatesPathQuery}?tab=${tab}&saved=1`);
}

export async function updateHiringTemplate(templateId: string, formData: FormData) {
  const me = await requireHiringTemplateUser();

  const existing = await prisma.hiringInterviewQuestionTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, title: true, category: true },
  });
  if (!existing) redirectWithError("Template not found.");
  const beforeTitle = existing.title;
  const beforeCategory = existing.category;

  const parsed = unwrapParsed(parseTemplateFormData(formData));

  const pipelineStageId = await resolvePipelineStageId(parsed.category, parsed.pipelineStageId);
  if (parsed.category === "QUESTIONNAIRE_GUIDE" && !pipelineStageId) {
    redirectWithError("Pick a funnel stage from the list.", "questionnaire");
  }

  if (parsed.body.length > 16000) redirectWithError("Template is too long (max 16k characters).");

  await prisma.$transaction(async (tx) => {
    await tx.hiringInterviewQuestionTemplate.update({
      where: { id: templateId },
      data: {
        category: parsed.category,
        pipelineStageId,
        title: parsed.title,
        body: parsed.body,
        sortOrder: parsed.sortOrder,
        subject: parsed.category === "EMAIL" ? parsed.subject : null,
        emailPurpose: parsed.category === "EMAIL" ? parsed.emailPurpose : null,
        jobFieldsJson: parsed.category === "JOB_POST" ? parsed.jobFieldsJson : null,
      },
    });
    await tx.hiringActivity.create({
      data: {
        kind: "HIRING_TEMPLATE_UPDATED",
        summary: `Template updated: ${parsed.title}`,
        payloadJson: JSON.stringify({
          templateId,
          before: { title: beforeTitle, category: beforeCategory },
          after: {
            title: parsed.title,
            category: parsed.category,
            emailPurpose: parsed.emailPurpose,
          },
        }),
        actorUserId: me.id,
      },
    });
  });

  const tab = parsed.category === "JOB_POST" ? "job" : parsed.category === "EMAIL" ? "email" : "questionnaire";
  revalidatePath("/hiring/templates");
  revalidatePath("/hiring/applications", "layout");
  revalidatePath("/hiring/jobs/new");
  revalidatePath("/hiring");
  revalidatePath("/hiring/activity");
  redirect(`${templatesPathQuery}?tab=${tab}&saved=1`);
}

export async function duplicateHiringTemplate(templateId: string, formData: FormData) {
  const me = await requireHiringTemplateUser();
  const tab = String(formData.get("tab") || "job").trim();

  const row = await prisma.hiringInterviewQuestionTemplate.findUnique({ where: { id: templateId } });
  if (!row) redirectWithError("Template not found.", tab);

  const created = await prisma.hiringInterviewQuestionTemplate.create({
    data: {
      category: row.category,
      pipelineStageId: row.pipelineStageId,
      title: `${row.title} (copy)`.slice(0, 200),
      body: row.body,
      sortOrder: row.sortOrder,
      subject: row.subject,
      emailPurpose: row.emailPurpose,
      jobFieldsJson: row.jobFieldsJson,
      createdById: me.id,
    },
  });

  await prisma.hiringActivity.create({
    data: {
      kind: "HIRING_TEMPLATE_CREATED",
      summary: `Template duplicated: ${created.title}`,
      payloadJson: JSON.stringify({ templateId: created.id, duplicatedFrom: templateId }),
      actorUserId: me.id,
    },
  });

  revalidatePath("/hiring/templates");
  redirect(`${templatesPathQuery}?tab=${tab}&saved=1`);
}

export async function deleteHiringTemplate(templateId: string, formData?: FormData) {
  const me = await requireHiringTemplateUser();
  const tab = formData ? String(formData.get("tab") || "").trim() : "";
  const existing = await prisma.hiringInterviewQuestionTemplate.findUnique({
    where: { id: templateId },
    select: { title: true, category: true },
  });
  await prisma.$transaction(async (tx) => {
    await tx.hiringInterviewQuestionTemplate.delete({ where: { id: templateId } });
    await tx.hiringActivity.create({
      data: {
        kind: "HIRING_TEMPLATE_DELETED",
        summary: `Template deleted: ${existing?.title ?? "Template"}`,
        payloadJson: JSON.stringify({
          templateId,
          title: existing?.title,
          category: existing?.category,
        }),
        actorUserId: me.id,
      },
    });
  });
  revalidatePath("/hiring/templates");
  revalidatePath("/hiring/applications", "layout");
  revalidatePath("/hiring");
  revalidatePath("/hiring/activity");
  const q = tab ? `?tab=${encodeURIComponent(tab)}&removed=1` : "?removed=1";
  redirect(`${templatesPathQuery}${q}`);
}
