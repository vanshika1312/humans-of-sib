"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type {
  HiringJobStatus,
} from "@/generated/prisma";
import {
  isJobStatus,
} from "@/lib/hiring-copy";
import { calendarDateFromInput, formatCalendarDate } from "@/lib/calendar-date";
import { isWorkArrangement } from "@/lib/hiring-job-copy";
import type { HiringJobWorkArrangement } from "@/generated/prisma";
import { departmentIdFromForm } from "@/lib/department-resolve";
import { normalizeExternalApplyUrl } from "@/lib/hiring-external-apply-url";
import { persistHiringResumeFile } from "@/lib/hiring-resume-upload";
import { defaultAppliedPipelineStageIdInTxn } from "@/lib/hiring-pipeline";

async function mergeResumeForIntake(formData: FormData): Promise<{ resumeUrl: string | null; error: string | null }> {
  const drive = nu(String(formData.get("resumeDriveUrl")));
  const file = formData.get("resumeFile");
  if (file instanceof File && file.size > 0) {
    const uploaded = await persistHiringResumeFile(file);
    if (uploaded === "TOO_LARGE") return { resumeUrl: null, error: "Résumé file is too large (max 12 MB)." };
    if (uploaded === "UNSUPPORTED_TYPE")
      return { resumeUrl: null, error: "Résumé must be a PDF, DOC, or DOCX file." };
    return { resumeUrl: uploaded, error: null };
  }
  return { resumeUrl: drive, error: null };
}

async function mergeResumeForCandidateUpdate(
  formData: FormData,
  fallback: string | null,
): Promise<{ resumeUrl: string | null; error: string | null }> {
  const file = formData.get("resumeFile");
  if (file instanceof File && file.size > 0) {
    const uploaded = await persistHiringResumeFile(file);
    if (uploaded === "TOO_LARGE") return { resumeUrl: null, error: "Résumé file is too large (max 12 MB)." };
    if (uploaded === "UNSUPPORTED_TYPE")
      return { resumeUrl: null, error: "Résumé must be a PDF, DOC, or DOCX file." };
    return { resumeUrl: uploaded, error: null };
  }
  const drive = nu(String(formData.get("resumeDriveUrl")));
  if (drive) return { resumeUrl: drive, error: null };
  return { resumeUrl: fallback, error: null };
}

type HiringTxnClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function hiringAttachApplication(
  tx: HiringTxnClient,
  args: {
    jobId: string;
    candidateId: string;
    applicationSource: string | null;
    actorUserId: string;
  },
) {
  const [job, cand] = await Promise.all([
    tx.hiringJob.findUnique({ where: { id: args.jobId }, select: { title: true, status: true } }),
    tx.hiringCandidate.findUnique({
      where: { id: args.candidateId },
      select: { fullName: true, email: true },
    }),
  ]);
  if (!job || job.status !== "OPEN") throw new Error("JOB_NOT_OPEN");
  const pipelineStageId = await defaultAppliedPipelineStageIdInTxn(tx);
  const app = await tx.hiringApplication.create({
    data: {
      jobId: args.jobId,
      candidateId: args.candidateId,
      applicationSource: args.applicationSource,
      pipelineStageId,
    },
  });
  await tx.hiringActivity.create({
    data: {
      kind: "APPLICATION_CREATED",
      summary: `${cand?.fullName ?? "Candidate"} (${cand?.email ?? "—"}) → ${job.title}`,
      payloadJson: JSON.stringify({
        jobId: args.jobId,
        applicationSource: args.applicationSource,
      }),
      candidateId: args.candidateId,
      applicationId: app.id,
      actorUserId: args.actorUserId,
    },
  });
}

function prismaUniqueViolation(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

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

/** Preserves query string on `returnPath` when appending flash params (e.g. `?view=by-job`). */
function mergeHiringReturnQuery(returnPath: string, params: Record<string, string>): string {
  try {
    const prefixed = returnPath.startsWith("/") ? `https://hos.local${returnPath}` : returnPath;
    const u = new URL(prefixed);
    for (const [key, value] of Object.entries(params)) {
      u.searchParams.set(key, value);
    }
    return `${u.pathname}${u.search}`;
  } catch {
    const qs = new URLSearchParams(params).toString();
    return `${returnPath}${returnPath.includes("?") ? "&" : "?"}${qs}`;
  }
}

function invalidateHiring(jobId?: string, applicationId?: string) {
  revalidatePath("/hiring");
  revalidatePath("/hiring/jobs");
  revalidatePath("/hiring/candidates/new");
  revalidatePath("/hiring/pipeline");
  revalidatePath("/hiring/applications");
  revalidatePath("/hiring/pipeline-stages");
  revalidatePath("/requisitions");
  revalidatePath("/careers");
  if (jobId) revalidatePath(`/hiring/jobs/${jobId}`);
  if (applicationId) revalidatePath(`/hiring/applications/${applicationId}`);
}

function openingsFromForm(fd: FormData): number {
  const n = Number(fd.get("openings"));
  if (!Number.isFinite(n)) return 1;
  return Math.min(500, Math.max(1, Math.floor(n)));
}

function applicationDeadlineFromForm(fd: FormData): { deadline: Date | null; invalid: boolean } {
  const raw = String(fd.get("applicationDeadline") || "").trim();
  if (!raw) return { deadline: null, invalid: false };
  const d = calendarDateFromInput(raw);
  if (Number.isNaN(d.getTime())) return { deadline: null, invalid: true };
  return { deadline: d, invalid: false };
}

function workArrangementFromForm(fd: FormData): HiringJobWorkArrangement | "INVALID" | "MISSING" {
  const raw = String(fd.get("workArrangement") || "").trim();
  if (!raw) return "MISSING";
  if (!isWorkArrangement(raw)) return "INVALID";
  return raw;
}

export async function createJob(formData: FormData) {
  const me = await requireHiringUser();
  const title = String(formData.get("title") || "").trim();
  if (!title) redirect("/hiring/jobs/new?error=" + encodeURIComponent("Add a job title."));
  const statusRaw = String(formData.get("status") || "DRAFT");
  const status: HiringJobStatus = isJobStatus(statusRaw) ? statusRaw : "DRAFT";
  const departmentId = await departmentIdFromForm(prisma, formData);
  const description = nu(String(formData.get("description")));
  const employmentType = nu(String(formData.get("employmentType")));
  const location = nu(String(formData.get("location")));

  const wa = workArrangementFromForm(formData);
  if (wa === "MISSING") {
    redirect(
      "/hiring/jobs/new?error=" +
        encodeURIComponent("Select whether the role is remote, hybrid, or on-site."),
    );
  }
  if (wa === "INVALID") {
    redirect("/hiring/jobs/new?error=" + encodeURIComponent("Invalid work arrangement."));
  }

  const { deadline, invalid: deadlineInvalid } = applicationDeadlineFromForm(formData);
  if (deadlineInvalid) {
    redirect(
      "/hiring/jobs/new?error=" + encodeURIComponent("Application deadline must be a valid date."),
    );
  }

  const openings = openingsFromForm(formData);
  const externalApplyUrl = normalizeExternalApplyUrl(formData.get("externalApplyUrl"));
  if (externalApplyUrl === "INVALID") {
    redirect(
      "/hiring/jobs/new?error=" +
        encodeURIComponent("Company apply URL must be a valid http(s) address, or leave it blank."),
    );
  }

  try {
    const job = await prisma.hiringJob.create({
      data: {
        title,
        description,
        employmentType,
        location,
        workArrangement: wa,
        experienceRequired: nu(String(formData.get("experienceRequired"))),
        salaryRange: nu(String(formData.get("salaryRange"))),
        skillsRequired: nu(String(formData.get("skillsRequired"))),
        applicationDeadline: deadline,
        openings,
        externalApplyUrl,
        departmentId,
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
  const departmentId = await departmentIdFromForm(prisma, formData);
  const description = nu(String(formData.get("description")));
  const employmentType = nu(String(formData.get("employmentType")));
  const location = nu(String(formData.get("location")));

  const wa = workArrangementFromForm(formData);
  if (wa === "MISSING") {
    redirect(
      `/hiring/jobs/${jobId}?error=` +
        encodeURIComponent("Select whether the role is remote, hybrid, or on-site."),
    );
  }
  if (wa === "INVALID") {
    redirect(`/hiring/jobs/${jobId}?error=` + encodeURIComponent("Invalid work arrangement."));
  }

  const { deadline, invalid: deadlineInvalid } = applicationDeadlineFromForm(formData);
  if (deadlineInvalid) {
    redirect(
      `/hiring/jobs/${jobId}?error=` + encodeURIComponent("Application deadline must be a valid date."),
    );
  }

  const openings = openingsFromForm(formData);
  const externalApplyUrl = normalizeExternalApplyUrl(formData.get("externalApplyUrl"));
  if (externalApplyUrl === "INVALID") {
    redirect(
      `/hiring/jobs/${jobId}?error=` +
        encodeURIComponent("Company apply URL must be a valid http(s) address, or leave it blank."),
    );
  }

  try {
    await prisma.hiringJob.update({
      where: { id: jobId },
      data: {
        title,
        description,
        employmentType,
        location,
        workArrangement: wa,
        experienceRequired: nu(String(formData.get("experienceRequired"))),
        salaryRange: nu(String(formData.get("salaryRange"))),
        skillsRequired: nu(String(formData.get("skillsRequired"))),
        applicationDeadline: deadline,
        openings,
        externalApplyUrl,
        departmentId,
        status,
      },
    });
    invalidateHiring(jobId);
    redirect(`/hiring/jobs/${jobId}?saved=1&edit=1`);
  } catch {
    redirect(`/hiring/jobs/${jobId}?error=` + encodeURIComponent("Could not update this job."));
  }
}

export async function closeJobPosting(jobId: string, formData: FormData) {
  await requireHiringUser();
  const returnTo = String(formData.get("returnTo") || "list").trim();

  await prisma.hiringJob.update({
    where: { id: jobId },
    data: { status: "CLOSED" },
  });

  invalidateHiring(jobId);
  if (returnTo === "detail") {
    redirect(`/hiring/jobs/${jobId}?closed=1`);
  }
  redirect("/hiring/jobs?closed=1");
}

export async function createCandidate(formData: FormData) {
  const me = await requireHiringUser();
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!fullName || !email) {
    redirect("/hiring/candidates/new?error=" + encodeURIComponent("Name and email are required."));
  }

  const phone = nu(String(formData.get("phone")));
  const candidateLocation = nu(String(formData.get("candidateLocation")));
  const source = nu(String(formData.get("source")));
  const notes = nu(String(formData.get("notes")));

  const targetJobIdRaw = nu(String(formData.get("targetJobId")));
  let targetJobId: string | null = null;
  if (targetJobIdRaw) {
    const openJob = await prisma.hiringJob.findFirst({
      where: { id: targetJobIdRaw, status: "OPEN" },
      select: { id: true },
    });
    if (!openJob) {
      redirect(
        "/hiring/candidates/new?error=" +
          encodeURIComponent(
            "That posting is no longer open. Pick another job or leave Job role applied unset.",
          ),
      );
    }
    targetJobId = openJob.id;
  }

  const { resumeUrl, error: resumeErr } = await mergeResumeForIntake(formData);
  if (resumeErr) {
    redirect("/hiring/candidates/new?error=" + encodeURIComponent(resumeErr));
  }

  const intakeSnapshot = JSON.stringify({
    fullName,
    phone,
    candidateLocation,
    source,
    resumeUrl,
    notes,
    targetJobId,
  });

  const existing = await prisma.hiringCandidate.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, fullName: true, email: true },
  });

  if (existing) {
    await prisma.hiringActivity.create({
      data: {
        kind: "CANDIDATE_DUPLICATE_INTAKE",
        summary: `Repeat intake for ${existing.email}: new form preserved for review (stored name: ${existing.fullName}).`,
        payloadJson: intakeSnapshot,
        candidateId: existing.id,
        actorUserId: me.id,
      },
    });
    invalidateHiring();
    revalidatePath(`/hiring/timeline/${existing.id}`);

    if (targetJobId) {
      try {
        await prisma.$transaction(async (tx) => {
          await hiringAttachApplication(tx, {
            jobId: targetJobId!,
            candidateId: existing.id,
            applicationSource: source,
            actorUserId: me.id,
          });
        });
        invalidateHiring(targetJobId);
        redirect(`/hiring/applications?linked=1`);
      } catch (e) {
        if (prismaUniqueViolation(e)) {
          redirect(
            `/hiring/applications?error=` +
              encodeURIComponent("That person already has an application for this job."),
          );
        }
        redirect(
          `/hiring/candidates/new?focus=${existing.id}&notice=duplicate&error=` +
            encodeURIComponent("Could not add them to that job."),
        );
      }
    }

    redirect(`/hiring/candidates/new?focus=${existing.id}&notice=duplicate`);
  }

  let newCandidateId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.hiringCandidate.create({
        data: {
          fullName,
          email,
          phone,
          candidateLocation,
          source,
          resumeUrl,
          notes,
          createdById: me.id,
        },
      });
      newCandidateId = created.id;

      await tx.hiringActivity.create({
        data: {
          kind: "CANDIDATE_CREATED",
          summary: `Candidate profile created: ${fullName} (${email})`,
          payloadJson: intakeSnapshot,
          candidateId: created.id,
          actorUserId: me.id,
        },
      });

      if (targetJobId) {
        await hiringAttachApplication(tx, {
          jobId: targetJobId,
          candidateId: created.id,
          applicationSource: source,
          actorUserId: me.id,
        });
      }
    });
  } catch (e) {
    if (prismaUniqueViolation(e)) {
      redirect("/hiring/candidates/new?error=" + encodeURIComponent("That applicant is already on this posting."));
    }
    redirect("/hiring/candidates/new?error=" + encodeURIComponent("Could not save this candidate."));
  }

  invalidateHiring(targetJobId ?? undefined);
  revalidatePath(`/hiring/timeline/${newCandidateId}`);
  redirect(targetJobId ? "/hiring/applications?added=1" : "/hiring/candidates/new?saved=1");
}

export async function createApplication(jobId: string, formData: FormData) {
  const me = await requireHiringUser();
  const candidateId = String(formData.get("candidateId") || "").trim();
  if (!candidateId) {
    redirect(`/hiring/jobs/${jobId}?error=` + encodeURIComponent("Choose a candidate to link."));
  }
  const applicationSource = nu(String(formData.get("applicationSource")));
  try {
    await prisma.$transaction(async (tx) => {
      const [job, cand] = await Promise.all([
        tx.hiringJob.findUnique({ where: { id: jobId }, select: { title: true } }),
        tx.hiringCandidate.findUnique({
          where: { id: candidateId },
          select: { fullName: true, email: true },
        }),
      ]);
      const pipelineStageId = await defaultAppliedPipelineStageIdInTxn(tx);
      const app = await tx.hiringApplication.create({
        data: {
          jobId,
          candidateId,
          applicationSource,
          pipelineStageId,
        },
      });
      await tx.hiringActivity.create({
        data: {
          kind: "APPLICATION_CREATED",
          summary: `${cand?.fullName ?? "Candidate"} (${cand?.email ?? "—"}) → ${job?.title ?? "Opening"}`,
          payloadJson: JSON.stringify({ jobId, applicationSource }),
          candidateId,
          applicationId: app.id,
          actorUserId: me.id,
        },
      });
    });
    invalidateHiring(jobId);
    revalidatePath(`/hiring/timeline/${candidateId}`);
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
  const me = await requireHiringUser();
  const pipelineStageIdRaw = String(formData.get("pipelineStageId") || "").trim();

  const returnPath = safeHiringReturnPath(formData.get("returnPath"));
  const before = await prisma.hiringApplication.findUnique({
    where: { id: applicationId },
    include: {
      job: { select: { title: true } },
      candidate: { select: { fullName: true, email: true } },
      pipelineStage: { select: { key: true, label: true } },
    },
  });

  if (!before) {
    redirect(
      mergeHiringReturnQuery(returnPath, {
        error: "Application not found.",
      }),
    );
  }

  const nextStage = await prisma.hiringPipelineStage.findUnique({
    where: { id: pipelineStageIdRaw },
    select: { id: true, key: true, label: true },
  });

  if (!nextStage || !pipelineStageIdRaw) {
    redirect(
      mergeHiringReturnQuery(returnPath, {
        error: "Pick a valid pipeline stage.",
      }),
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.hiringApplication.update({
        where: { id: applicationId },
        data: { pipelineStageId: nextStage.id },
      });
      await tx.hiringActivity.create({
        data: {
          kind: "APPLICATION_STAGE_CHANGED",
          summary: `${before.candidate.fullName ?? "Candidate"} · ${before.job.title ?? "Job"}: ${before.pipelineStage.label} → ${nextStage.label}`,
          payloadJson: JSON.stringify({
            applicationId,
            jobId: before.jobId,
            fromStageKey: before.pipelineStage.key,
            toStageKey: nextStage.key,
            fromStageLabel: before.pipelineStage.label,
            toStageLabel: nextStage.label,
          }),
          candidateId: before.candidateId,
          applicationId,
          actorUserId: me.id,
        },
      });
    });

    invalidateHiring(before.jobId, applicationId);
    revalidatePath(`/hiring/timeline/${before.candidateId}`);
    redirect(
      mergeHiringReturnQuery(returnPath, {
        moved: "1",
      }),
    );
  } catch {
    redirect(
      mergeHiringReturnQuery(returnPath, {
        error: "Could not update stage.",
      }),
    );
  }
}

export async function createHiringApplicationReview(applicationId: string, formData: FormData) {
  const me = await requireHiringUser();
  const comment = String(formData.get("comment") || "").trim();
  const ratingRaw = String(formData.get("rating") || "").trim();
  const ratingNull = ratingRaw === "" ? null : Number(ratingRaw);
  const returnPath = safeHiringReturnPath(formData.get("returnPath"));

  if (comment.length < 3) {
    redirect(
      mergeHiringReturnQuery(returnPath, {
        error: "Feedback needs at least a few words.",
      }),
    );
  }
  if (ratingNull !== null && (!Number.isInteger(ratingNull) || ratingNull < 1 || ratingNull > 5)) {
    redirect(
      mergeHiringReturnQuery(returnPath, {
        error: "Rating must be between 1 and 5, or leave it blank.",
      }),
    );
  }

  const app = await prisma.hiringApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, jobId: true },
  });
  if (!app) {
    redirect(
      mergeHiringReturnQuery(returnPath, {
        error: "Application not found.",
      }),
    );
  }

  await prisma.hiringApplicationReview.create({
    data: {
      applicationId,
      authorId: me.id,
      comment,
      rating: ratingNull,
    },
  });

  invalidateHiring(app.jobId, applicationId);
  redirect(
    mergeHiringReturnQuery(returnPath, {
      reviewSaved: "1",
    }),
  );
}

export async function updateHiringApplicationNotes(applicationId: string, formData: FormData) {
  await requireHiringUser();
  const notes = nu(String(formData.get("notes")));
  const row = await prisma.hiringApplication.findUnique({
    where: { id: applicationId },
    select: { jobId: true },
  });
  if (!row) {
    redirect("/hiring/applications?error=" + encodeURIComponent("Application not found."));
  }
  await prisma.hiringApplication.update({
    where: { id: applicationId },
    data: { notes },
  });
  invalidateHiring(row.jobId, applicationId);
  redirect(`/hiring/applications/${applicationId}?notesSaved=1`);
}

function guessAttachmentNameFromUrl(raw: string): string {
  try {
    const p = new URL(raw).pathname.split("/").filter(Boolean).pop();
    return p ? decodeURIComponent(p).slice(0, 280) : "Drive / web link";
  } catch {
    return "Drive / web link";
  }
}

export async function addHiringApplicationAttachment(applicationId: string, formData: FormData) {
  const me = await requireHiringUser();
  const app = await prisma.hiringApplication.findUnique({
    where: { id: applicationId },
    select: { jobId: true },
  });
  if (!app) {
    redirect("/hiring/applications?error=" + encodeURIComponent("Application not found."));
  }

  const catRaw = String(formData.get("attachmentCategory") || "").trim().slice(0, 80);
  const category = catRaw.length ? catRaw : "Resume";
  const driveOrLinkUrl = nu(String(formData.get("driveOrLinkUrl")));
  const displayOverride = nu(String(formData.get("attachmentDisplayName")));
  const file = formData.get("attachmentFile");

  let resolvedUrl = "";
  let resolvedName = "";

  if (file instanceof File && file.size > 0) {
    const uploaded = await persistHiringResumeFile(file);
    if (uploaded === "TOO_LARGE") {
      redirect(
        `/hiring/applications/${applicationId}?error=` +
          encodeURIComponent("Attachment is too large (max 12 MB)."),
      );
    }
    if (uploaded === "UNSUPPORTED_TYPE") {
      redirect(
        `/hiring/applications/${applicationId}?error=` +
          encodeURIComponent("Attachments must be PDF, DOC, or DOCX."),
      );
    }
    resolvedUrl = uploaded;
    resolvedName = (displayOverride || file.name).slice(0, 280);
  } else if (driveOrLinkUrl) {
    resolvedUrl = driveOrLinkUrl;
    resolvedName = (displayOverride || guessAttachmentNameFromUrl(driveOrLinkUrl)).slice(0, 280);
  }

  if (!resolvedUrl || !resolvedName) {
    redirect(
      `/hiring/applications/${applicationId}?error=` +
        encodeURIComponent("Paste a Google Drive / link or choose a PDF or Word file."),
    );
  }

  await prisma.hiringApplicationAttachment.create({
    data: {
      applicationId,
      url: resolvedUrl.slice(0, 2048),
      fileName: resolvedName.slice(0, 280),
      category,
      addedByUserId: me.id,
    },
  });
  invalidateHiring(app.jobId, applicationId);
  redirect(`/hiring/applications/${applicationId}?attached=1`);
}

export async function deleteHiringApplicationAttachment(attachmentId: string, formData: FormData) {
  await requireHiringUser();
  const redirectTo = nu(String(formData.get("redirectTo"))) || "/hiring/applications";
  const att = await prisma.hiringApplicationAttachment.findUnique({
    where: { id: attachmentId },
    select: { applicationId: true, application: { select: { jobId: true } } },
  });
  if (!att) redirect(redirectTo + "?error=" + encodeURIComponent("Attachment not found."));

  await prisma.hiringApplicationAttachment.delete({ where: { id: attachmentId } });
  invalidateHiring(att.application.jobId, att.applicationId);
  redirect(`/hiring/applications/${att.applicationId}?attachmentRemoved=1`);
}

export async function updateHiringCandidate(candidateId: string, formData: FormData) {
  const me = await requireHiringUser();
  const before = await prisma.hiringCandidate.findUnique({ where: { id: candidateId } });
  if (!before) {
    redirect("/hiring/candidates/new?error=" + encodeURIComponent("Candidate not found."));
  }

  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!fullName || !email) {
    redirect(`/hiring/timeline/${candidateId}?error=` + encodeURIComponent("Name and email are required."));
  }

  const conflict = await prisma.hiringCandidate.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      NOT: { id: candidateId },
    },
    select: { id: true },
  });
  if (conflict) {
    redirect(
      `/hiring/timeline/${candidateId}?error=` +
        encodeURIComponent("That email is already used by another candidate profile."),
    );
  }

  const { resumeUrl: mergedResumeUrl, error: resumeErr } = await mergeResumeForCandidateUpdate(
    formData,
    before.resumeUrl,
  );
  if (resumeErr) {
    redirect(`/hiring/timeline/${candidateId}?error=` + encodeURIComponent(resumeErr));
  }

  const after = {
    fullName,
    email,
    phone: nu(String(formData.get("phone"))),
    candidateLocation: nu(String(formData.get("candidateLocation"))),
    source: nu(String(formData.get("source"))),
    resumeUrl: mergedResumeUrl,
    notes: nu(String(formData.get("notes"))),
  };

  await prisma.$transaction(async (tx) => {
    await tx.hiringCandidate.update({
      where: { id: candidateId },
      data: after,
    });
    await tx.hiringActivity.create({
      data: {
        kind: "CANDIDATE_UPDATED",
        summary: `Profile saved: ${fullName} (${email})`,
        payloadJson: JSON.stringify({
          before: {
            fullName: before.fullName,
            email: before.email,
            phone: before.phone,
            candidateLocation: before.candidateLocation,
            source: before.source,
            resumeUrl: before.resumeUrl,
            notes: before.notes,
          },
          after,
        }),
        candidateId,
        actorUserId: me.id,
      },
    });
  });

  invalidateHiring();
  revalidatePath(`/hiring/timeline/${candidateId}`);
  redirect(`/hiring/timeline/${candidateId}?saved=1`);
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
  skillsRequired: string | null;
  proposedDeadlineLabel: string | null;
}) {
  const lines = [
    "",
    "---",
    `Headcount requisition · ${args.positions} role(s)`,
    `Requested by: ${args.requesterName || "—"} · ${args.requesterEmail}`,
    `Business case: ${args.justification || "—"}`,
  ];
  if (args.skillsRequired?.trim()) {
    lines.push("", "Skills & qualifications:", args.skillsRequired.trim());
  }
  if (args.proposedDeadlineLabel) {
    lines.push(`Proposed deadline: ${args.proposedDeadlineLabel}`);
  }
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

  const proposedDeadlineLabel = req.proposedDeadline
    ? formatCalendarDate(req.proposedDeadline)
    : null;

  const baseDesc = req.description?.trim() ?? "";
  const suffix = requisitionJobDescriptionBlock({
    positions: req.positions,
    requesterName: req.requestedBy.name,
    requesterEmail: req.requestedBy.email,
    justification: req.justification,
    skillsRequired: req.skillsRequired,
    proposedDeadlineLabel,
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
          skillsRequired: req.skillsRequired,
          applicationDeadline: req.proposedDeadline,
          openings: req.positions,
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
