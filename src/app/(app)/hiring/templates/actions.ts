"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import type { HiringTemplateCategory } from "@/generated/prisma";

import { isHiringTemplateCategory } from "@/lib/hiring-template-category";

const HR_GATE = ["CEO", "ADMIN", "HR"];

const templatesPathQuery = "/hiring/templates";

async function requireHiringTemplateUser() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !HR_GATE.includes(me.role)) redirect("/home");
  return me;
}

function redirectWithError(msg: string) {
  redirect(`${templatesPathQuery}?error=${encodeURIComponent(msg)}`);
}

export async function createHiringTemplate(formData: FormData) {
  const me = await requireHiringTemplateUser();

  const categoryRaw = String(formData.get("category") || "").trim();
  if (!isHiringTemplateCategory(categoryRaw)) {
    redirectWithError("Pick a template type.");
  }
  const category = categoryRaw as HiringTemplateCategory;

  const pipelineStageRaw = String(formData.get("pipelineStageId") || "").trim();

  let pipelineStageId: string | null = null;

  if (category === "QUESTIONNAIRE_GUIDE") {
    if (!pipelineStageRaw) redirectWithError("Questionnaire templates must map to a funnel stage.");
    const exists = await prisma.hiringPipelineStage.findUnique({
      where: { id: pipelineStageRaw },
      select: { id: true },
    });
    if (exists) {
      pipelineStageId = exists.id;
    } else {
      redirectWithError("Pick a funnel stage from the list.");
    }
  }

  const title = String(formData.get("title") || "").trim().slice(0, 200);
  const body = String(formData.get("body") || "").trim();
  if (!title || body.length < 10) {
    redirectWithError("Add a title and at least a few lines of content.");
  }
  if (body.length > 16000) {
    redirectWithError("Template is too long (max 16k characters).");
  }

  await prisma.hiringInterviewQuestionTemplate.create({
    data: {
      category,
      pipelineStageId,
      title,
      body,
      sortOrder: 0,
      createdById: me.id,
    },
  });

  revalidatePath("/hiring/templates");
  revalidatePath("/hiring/applications", "layout");
  revalidatePath("/hiring");
  redirect(`${templatesPathQuery}?saved=1`);
}

export async function updateHiringTemplate(templateId: string, formData: FormData) {
  await requireHiringTemplateUser();

  const existing = await prisma.hiringInterviewQuestionTemplate.findUnique({
    where: { id: templateId },
    select: { id: true },
  });
  if (!existing) redirectWithError("Template not found.");

  const categoryRaw = String(formData.get("category") || "").trim();
  if (!isHiringTemplateCategory(categoryRaw)) {
    redirectWithError("Pick a template type.");
  }
  const category = categoryRaw as HiringTemplateCategory;

  const pipelineStageRaw = String(formData.get("pipelineStageId") || "").trim();
  let pipelineStageId: string | null = null;

  if (category === "QUESTIONNAIRE_GUIDE") {
    if (!pipelineStageRaw) redirectWithError("Questionnaire templates must map to a funnel stage.");
    const stageRow = await prisma.hiringPipelineStage.findUnique({
      where: { id: pipelineStageRaw },
      select: { id: true },
    });
    if (stageRow) {
      pipelineStageId = stageRow.id;
    } else {
      redirectWithError("Pick a funnel stage from the list.");
    }
  }

  const title = String(formData.get("title") || "").trim().slice(0, 200);
  const body = String(formData.get("body") || "").trim();
  if (!title || body.length < 10) {
    redirectWithError("Add a title and at least a few lines of content.");
  }
  if (body.length > 16000) {
    redirectWithError("Template is too long (max 16k characters).");
  }

  await prisma.hiringInterviewQuestionTemplate.update({
    where: { id: templateId },
    data: {
      category,
      pipelineStageId,
      title,
      body,
    },
  });

  revalidatePath("/hiring/templates");
  revalidatePath("/hiring/applications", "layout");
  revalidatePath("/hiring");
  redirect(`${templatesPathQuery}?saved=1`);
}

export async function deleteHiringTemplate(templateId: string) {
  await requireHiringTemplateUser();
  await prisma.hiringInterviewQuestionTemplate.delete({ where: { id: templateId } });
  revalidatePath("/hiring/templates");
  revalidatePath("/hiring/applications", "layout");
  revalidatePath("/hiring");
  redirect(`${templatesPathQuery}?removed=1`);
}
