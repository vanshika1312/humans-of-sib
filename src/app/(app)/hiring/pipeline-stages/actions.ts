"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const HR_GATE = ["CEO", "ADMIN", "HR"];
const SETTINGS = "/hiring/pipeline-stages";

async function requireHiringHr() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !HR_GATE.includes(me.role)) redirect("/home");
  return me;
}

function keyCandidateFromLabel(label: string): string {
  let k = label
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
  return k.length ? k : `STAGE_${Date.now().toString(36).toUpperCase()}`;
}

function revalidateHiringStages() {
  revalidatePath(SETTINGS);
  revalidatePath("/hiring");
  revalidatePath("/hiring/activity");
  revalidatePath("/hiring/pipeline");
  revalidatePath("/hiring/templates");
  revalidatePath("/hiring/applications", "layout");
}

export async function createPipelineStage(formData: FormData) {
  const me = await requireHiringHr();
  const label = String(formData.get("label") || "").trim().slice(0, 160);
  if (!label) {
    redirect(`${SETTINGS}?error=${encodeURIComponent("Add a visible name for this stage.")}`);
  }

  let key = keyCandidateFromLabel(label);
  for (let i = 0; i < 20; i++) {
    const taken = await prisma.hiringPipelineStage.findUnique({
      where: { key },
      select: { id: true },
    });
    if (!taken) break;
    key = `${key}_${(i + 1).toString()}`.slice(0, 64);
  }

  const maxOrd = await prisma.hiringPipelineStage.aggregate({ _max: { sortOrder: true } });

  const stage = await prisma.hiringPipelineStage.create({
    data: {
      key,
      label,
      sortOrder: (maxOrd._max.sortOrder ?? 0) + 10,
    },
  });

  await prisma.hiringActivity.create({
    data: {
      kind: "PIPELINE_STAGE_CREATED",
      summary: `Pipeline stage added: ${label}`,
      payloadJson: JSON.stringify({ stageId: stage.id, key, label }),
      actorUserId: me.id,
    },
  });

  revalidateHiringStages();
  redirect(`${SETTINGS}?saved=1`);
}

export async function updatePipelineStage(stageId: string, formData: FormData) {
  const me = await requireHiringHr();

  const label = String(formData.get("label") || "").trim().slice(0, 160);
  if (!label) {
    redirect(`${SETTINGS}?error=${encodeURIComponent("Stage name cannot be empty.")}`);
  }

  const sortRaw = String(formData.get("sortOrder") || "").trim();
  const parsed = Number(sortRaw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    redirect(`${SETTINGS}?error=${encodeURIComponent("Sort order must be a whole number.")}`);
  }

  const isHired = formData.get("isHired") === "true";
  const isRejected = formData.get("isRejected") === "true";

  const before = await prisma.hiringPipelineStage.findUnique({
    where: { id: stageId },
    select: { id: true, label: true, sortOrder: true, isHired: true, isRejected: true, key: true },
  });
  if (!before) {
    redirect(`${SETTINGS}?error=${encodeURIComponent("Stage not found.")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.hiringPipelineStage.update({
      where: { id: stageId },
      data: {
        label,
        sortOrder: parsed,
        isHired,
        isRejected,
      },
    });
    await tx.hiringActivity.create({
      data: {
        kind: "PIPELINE_STAGE_UPDATED",
        summary: `Pipeline stage updated: ${label}`,
        payloadJson: JSON.stringify({
          stageId,
          before,
          after: { label, sortOrder: parsed, isHired, isRejected },
        }),
        actorUserId: me.id,
      },
    });
  });

  revalidateHiringStages();
  redirect(`${SETTINGS}?edited=1`);
}

export async function deletePipelineStage(stageId: string) {
  const me = await requireHiringHr();

  const nApps = await prisma.hiringApplication.count({ where: { pipelineStageId: stageId } });
  if (nApps > 0) {
    redirect(
      `${SETTINGS}?error=` +
        encodeURIComponent(`Cannot delete — ${nApps} applicant(s) are still in this stage. Move them first.`),
    );
  }

  const nTpl = await prisma.hiringInterviewQuestionTemplate.count({
    where: { pipelineStageId: stageId },
  });
  if (nTpl > 0) {
    redirect(
      `${SETTINGS}?error=` +
        encodeURIComponent(
          "Cannot delete — questionnaire templates still reference this stage. Retarget or remove them.",
        ),
    );
  }

  const stages = await prisma.hiringPipelineStage.count();
  if (stages <= 1) {
    redirect(`${SETTINGS}?error=` + encodeURIComponent("Keep at least one pipeline stage."));
  }

  const stage = await prisma.hiringPipelineStage.findUnique({
    where: { id: stageId },
    select: { label: true, key: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.hiringPipelineStage.delete({ where: { id: stageId } });
    await tx.hiringActivity.create({
      data: {
        kind: "PIPELINE_STAGE_DELETED",
        summary: `Pipeline stage removed: ${stage?.label ?? "Stage"}`,
        payloadJson: JSON.stringify({ stageId, key: stage?.key, label: stage?.label }),
        actorUserId: me.id,
      },
    });
  });
  revalidateHiringStages();
  redirect(`${SETTINGS}?removed=1`);
}
