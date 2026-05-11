"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type {
  HiringApplicationStage,
  HiringJobStatus,
} from "@/generated/prisma";
import {
  isApplicationStage,
  isJobStatus,
} from "@/lib/hiring-copy";

const HR_GATE = ["CEO", "ADMIN", "HR"];

async function requireHiringUser() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !HR_GATE.includes(me.role)) redirect("/home");
  return me;
}

function safeHiringReturnPath(raw: unknown): `/hiring${string}` {
  const path = typeof raw === "string" ? raw.trim() : "";
  if (path.startsWith("/hiring") && !path.includes("//")) {
    return path as `/hiring${string}`;
  }
  return "/hiring/pipeline";
}

function invalidateHiring(jobId?: string) {
  revalidatePath("/hiring");
  revalidatePath("/hiring/jobs");
  revalidatePath("/hiring/candidates");
  revalidatePath("/hiring/pipeline");
  revalidatePath("/requisitions");
  if (jobId) revalidatePath(`/hiring/jobs/${jobId}`);
}

export async function createJob(formData: FormData) {
  const me = await requireHiringUser();
  const title = String(formData.get("title") || "").trim();
  if (!title) redirect("/hiring/jobs/new?error=" + encodeURIComponent("Add a job title."));
  const statusRaw = String(formData.get("status") || "DRAFT");
  const status: HiringJobStatus = isJobStatus(statusRaw) ? statusRaw : "DRAFT";
  const departmentIdRaw = String(formData.get("departmentId") || "").trim();
  const description = nu(String(formData.get("description")));
  const employmentType = nu(String(formData.get("employmentType")));
  const location = nu(String(formData.get("location")));

  try {
    const job = await prisma.hiringJob.create({
      data: {
        title,
        description,
        employmentType,
        location,
        departmentId: departmentIdRaw || null,
        status,
        createdById: me.id,
      },
    });
    invalidateHiring(job.id);
    redirect(`/hiring/jobs/${job.id}`);
  } catch {
    redirect("/hiring/jobs/new?error=" + encodeURIComponent("Could not save the job."));
  }
}

export async function updateJobPosting(jobId: string, formData: FormData) {
  await requireHiringUser();
  const title = String(formData.get("title") || "").trim();
  if (!title) {
    redirect(`/hiring/jobs/${jobId}?error=` + encodeURIComponent("Job title cannot be empty."));
  }
  const statusRaw = String(formData.get("status") || "DRAFT");
  const status: HiringJobStatus = isJobStatus(statusRaw) ? statusRaw : "DRAFT";
  const departmentIdRaw = String(formData.get("departmentId") || "").trim();
  const description = nu(String(formData.get("description")));
  const employmentType = nu(String(formData.get("employmentType")));
  const location = nu(String(formData.get("location")));

  try {
    await prisma.hiringJob.update({
      where: { id: jobId },
      data: {
        title,
        description,
        employmentType,
        location,
        departmentId: departmentIdRaw || null,
        status,
      },
    });
    invalidateHiring(jobId);
    redirect(`/hiring/jobs/${jobId}?saved=1`);
  } catch {
    redirect(`/hiring/jobs/${jobId}?error=` + encodeURIComponent("Could not update this job."));
  }
}

export async function createCandidate(formData: FormData) {
  const me = await requireHiringUser();
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!fullName || !email) {
    redirect("/hiring/candidates?error=" + encodeURIComponent("Name and email are required."));
  }

  await prisma.hiringCandidate.create({
    data: {
      fullName,
      email,
      phone: nu(String(formData.get("phone"))),
      source: nu(String(formData.get("source"))),
      resumeUrl: nu(String(formData.get("resumeUrl"))),
      notes: nu(String(formData.get("notes"))),
      createdById: me.id,
    },
  });
  invalidateHiring();
  redirect("/hiring/candidates?saved=1");
}

export async function createApplication(jobId: string, formData: FormData) {
  await requireHiringUser();
  const candidateId = String(formData.get("candidateId") || "").trim();
  if (!candidateId) {
    redirect(`/hiring/jobs/${jobId}?error=` + encodeURIComponent("Choose a candidate to link."));
  }
  try {
    await prisma.hiringApplication.create({
      data: {
        jobId,
        candidateId,
      },
    });
    invalidateHiring(jobId);
    redirect(`/hiring/jobs/${jobId}?applied=1`);
  } catch (e: unknown) {
    const dup =
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002";
    if (dup) {
      redirect(
        `/hiring/jobs/${jobId}?error=` +
          encodeURIComponent("This candidate is already in the funnel for this job."),
      );
    }
    redirect(`/hiring/jobs/${jobId}?error=` + encodeURIComponent("Could not add this application."));
  }
}

export async function updateApplicationStage(applicationId: string, formData: FormData) {
  await requireHiringUser();
  const stageRaw = String(formData.get("stage") || "");
  const stage: HiringApplicationStage | null = isApplicationStage(stageRaw) ? stageRaw : null;
  if (!stage) {
    redirect(safeHiringReturnPath(formData.get("returnPath")) + "?error=" + encodeURIComponent("Invalid stage."));
  }
  const returnPath = safeHiringReturnPath(formData.get("returnPath"));
  try {
    const row = await prisma.hiringApplication.update({
      where: { id: applicationId },
      data: { stage },
      select: { jobId: true },
    });
    invalidateHiring(row.jobId);
    redirect(returnPath + "?moved=1");
  } catch {
    redirect(returnPath + "?error=" + encodeURIComponent("Could not update stage."));
  }
}

function nu(raw: string) {
  const t = raw.trim();
  return t.length ? t : null;
}

function requisitionJobDescriptionBlock(args: {
  positions: number;
  requesterName: string | null;
  requesterEmail: string;
  justification: string | null;
}) {
  const lines = [
    "",
    "---",
    `Headcount requisition · ${args.positions} role(s)`,
    `Requested by: ${args.requesterName || "—"} · ${args.requesterEmail}`,
    `Business case: ${args.justification || "—"}`,
  ];
  return lines.join("\n");
}

export async function approveHiringRequisition(requisitionId: string) {
  const me = await requireHiringUser();
  const req = await prisma.hiringRequisition.findUnique({
    where: { id: requisitionId },
    include: {
      requestedBy: { select: { name: true, email: true } },
    },
  });
  if (!req) {
    redirect("/hiring?reqError=" + encodeURIComponent("Requisition not found."));
  }
  if (req.status !== "PENDING") {
    redirect("/hiring?reqError=" + encodeURIComponent("This request was already handled."));
  }

  const baseDesc = req.description?.trim() ?? "";
  const suffix = requisitionJobDescriptionBlock({
    positions: req.positions,
    requesterName: req.requestedBy.name,
    requesterEmail: req.requestedBy.email,
    justification: req.justification,
  });
  const description = baseDesc ? `${baseDesc}\n${suffix}` : suffix.trimStart();

  try {
    await prisma.$transaction(async (tx) => {
      const job = await tx.hiringJob.create({
        data: {
          title: req.title,
          description,
          employmentType: req.employmentType,
          location: req.location,
          departmentId: req.departmentId,
          status: "DRAFT",
          createdById: me.id,
        },
      });
      await tx.hiringRequisition.update({
        where: { id: requisitionId },
        data: {
          status: "APPROVED",
          reviewedByUserId: me.id,
          reviewedAt: new Date(),
          resultingJobId: job.id,
          reviewNote: null,
        },
      });
    });
    invalidateHiring();
    redirect("/hiring?reqApproved=1");
  } catch {
    redirect("/hiring?reqError=" + encodeURIComponent("Could not approve this requisition."));
  }
}

export async function rejectHiringRequisition(requisitionId: string, formData: FormData) {
  const me = await requireHiringUser();
  const note = nu(String(formData.get("reviewNote") ?? ""));
  const req = await prisma.hiringRequisition.findUnique({ where: { id: requisitionId } });
  if (!req) {
    redirect("/hiring?reqError=" + encodeURIComponent("Requisition not found."));
  }
  if (req.status !== "PENDING") {
    redirect("/hiring?reqError=" + encodeURIComponent("This request was already handled."));
  }
  await prisma.hiringRequisition.update({
    where: { id: requisitionId },
    data: {
      status: "REJECTED",
      reviewedByUserId: me.id,
      reviewedAt: new Date(),
      reviewNote: note,
    },
  });
  invalidateHiring();
  redirect("/hiring?reqRejected=1");
}
