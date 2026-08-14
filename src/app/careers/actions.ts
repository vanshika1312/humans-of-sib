"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { candidateSignIn, candidateSignOut } from "@/auth-candidate";
import { prisma } from "@/lib/prisma";
import { requireCandidateSession, safeCandidateCallbackUrl } from "@/lib/candidate-session";
import { SELF_SIGNUP_SOURCE } from "@/lib/hiring-candidate-portal";
import { createHiringApplicationInTxn, findWithdrawnPipelineStageId } from "@/lib/hiring-create-application";
import { hiringJobAcceptingPublicApplications } from "@/lib/hiring-job-active";
import { persistHiringResumeFile, persistHiringUploadFile } from "@/lib/hiring-resume-upload";
import { collectScreeningAnswersFromForm } from "@/lib/hiring-job-questions";
import { normalizeOptionalHttpUrl } from "@/lib/hiring-http-url";
import { findPsychometricPipelineStageId } from "@/lib/hiring-pipeline";
import {
  assessmentEligible,
  buildAssessmentQuestions,
  collectAssessmentAnswersFromForm,
  responsesToJson,
  scorePsychometricDimensions,
  validateAssessmentAnswers,
} from "@/lib/hiring-assessment";

function nu(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function flashRedirect(path: string, error: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(error)}`);
}

function authResultLooksLikeFailure(url: string): boolean {
  try {
    const parsed = new URL(url, "http://localhost");
    if (parsed.searchParams.has("error")) return true;
    return (
      parsed.pathname === "/sign-in" ||
      parsed.pathname === "/signin" ||
      parsed.pathname === "/careers/sign-in"
    );
  } catch {
    return false;
  }
}

function jobPathFromApplyCallback(callbackUrl: string): string | null {
  const path = safeCandidateCallbackUrl(callbackUrl).split("?")[0] ?? "";
  const match = path.match(/^\/careers\/([^/]+)\/apply\/?$/);
  return match?.[1] ? `/careers/${match[1]}` : null;
}

function candidateFormBack(callbackUrl: string, kind: "register" | "signin"): string {
  const jobPath = jobPathFromApplyCallback(callbackUrl);
  if (jobPath) {
    return kind === "signin" ? `${jobPath}?auth=signin` : `${jobPath}?auth=register`;
  }
  const dest = safeCandidateCallbackUrl(callbackUrl);
  return kind === "signin"
    ? `/careers/sign-in?callbackUrl=${encodeURIComponent(dest)}`
    : `/careers/sign-up?callbackUrl=${encodeURIComponent(dest)}`;
}

/** Sets the candidate session cookie, then always continue onto the public apply/jobs flow. */
async function completeCandidateSignIn(
  email: string,
  password: string,
  callbackUrl: string,
  onAuthError: () => never,
): Promise<never> {
  const dest = safeCandidateCallbackUrl(callbackUrl);
  try {
    const result = await candidateSignIn("candidate-credentials", {
      email,
      password,
      redirectTo: dest,
      redirect: false,
    });
    if (typeof result === "string" && authResultLooksLikeFailure(result)) {
      onAuthError();
    }
  } catch (error) {
    if (error instanceof AuthError) onAuthError();
    throw error;
  }
  redirect(dest);
}

async function extractResumeTextIfPossible(file: File): Promise<string | null> {
  try {
    const { extractResumeTextFromBuffer } = await import("@/lib/hiring-resume-text");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractResumeTextFromBuffer(buffer, file.name);
    return result.ok ? result.text : null;
  } catch {
    return null;
  }
}

async function mergeResumeUpload(
  formData: FormData,
  fallbackUrl: string | null,
): Promise<{ resumeUrl: string | null; resumeText: string | null; error: string | null }> {
  const file = formData.get("resumeFile");
  if (file instanceof File && file.size > 0) {
    const uploaded = await persistHiringResumeFile(file);
    if (uploaded === "TOO_LARGE")
      return { resumeUrl: null, resumeText: null, error: "Résumé file is too large (max 12 MB)." };
    if (uploaded === "UNSUPPORTED_TYPE")
      return { resumeUrl: null, resumeText: null, error: "Résumé must be a PDF, DOC, or DOCX file." };
    const resumeText = await extractResumeTextIfPossible(file);
    return { resumeUrl: uploaded, resumeText, error: null };
  }
  return { resumeUrl: fallbackUrl, resumeText: null, error: null };
}

function invalidateCandidatePaths(jobId?: string) {
  revalidatePath("/careers");
  revalidatePath("/careers/portal");
  revalidatePath("/careers/portal/profile");
  revalidatePath("/careers/portal/applications");
  revalidatePath("/hiring");
  revalidatePath("/hiring/applications");
  revalidatePath("/hiring/pipeline");
  revalidatePath("/hiring/candidates");
  if (jobId) {
    revalidatePath(`/hiring/jobs/${jobId}`);
    revalidatePath(`/careers/${jobId}`);
    revalidatePath(`/careers/${jobId}/apply`);
  }
}

export async function registerCandidate(formData: FormData) {
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const phone = nu(String(formData.get("phone") || ""));
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirmPassword") || "");
  const callbackUrl = safeCandidateCallbackUrl(String(formData.get("callbackUrl") || ""));

  const back = candidateFormBack(callbackUrl, "register");

  if (!fullName || !email) flashRedirect(back, "Name and email are required.");
  if (password.length < 8) flashRedirect(back, "Password must be at least 8 characters.");
  if (password !== confirm) flashRedirect(back, "Passwords do not match.");

  const existingPortal = await prisma.hiringCandidatePortalAccount.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingPortal) {
    flashRedirect(
      candidateFormBack(callbackUrl, "signin"),
      "An account with this email already exists. Sign in instead.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let existingCandidate = await prisma.hiringCandidate.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, portalAccount: { select: { id: true } } },
  });

  if (existingCandidate?.portalAccount) {
    flashRedirect(
      candidateFormBack(callbackUrl, "signin"),
      "An account with this email already exists. Sign in instead.",
    );
  }

  try {
    if (existingCandidate) {
      await prisma.$transaction(async (tx) => {
        await tx.hiringCandidate.update({
          where: { id: existingCandidate!.id },
          data: {
            fullName,
            phone: phone ?? undefined,
            source: SELF_SIGNUP_SOURCE,
          },
        });
        await tx.hiringCandidatePortalAccount.create({
          data: {
            email,
            passwordHash,
            candidateId: existingCandidate!.id,
          },
        });
        await tx.hiringActivity.create({
          data: {
            kind: "CANDIDATE_CREATED",
            summary: `Careers portal account linked for ${fullName} (${email})`,
            payloadJson: JSON.stringify({ source: SELF_SIGNUP_SOURCE, linkedExisting: true }),
            candidateId: existingCandidate!.id,
          },
        });
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const created = await tx.hiringCandidate.create({
          data: {
            fullName,
            email,
            phone,
            source: SELF_SIGNUP_SOURCE,
          },
        });
        await tx.hiringCandidatePortalAccount.create({
          data: {
            email,
            passwordHash,
            candidateId: created.id,
          },
        });
        await tx.hiringActivity.create({
          data: {
            kind: "CANDIDATE_CREATED",
            summary: `Careers portal signup: ${fullName} (${email})`,
            payloadJson: JSON.stringify({ source: SELF_SIGNUP_SOURCE }),
            candidateId: created.id,
          },
        });
      });
    }
  } catch {
    flashRedirect(back, "Could not create your account. Try again.");
  }

  await completeCandidateSignIn(email, password, callbackUrl, () =>
    flashRedirect(candidateFormBack(callbackUrl, "signin"), "Account created — please sign in."),
  );
}

export async function loginCandidate(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const callbackUrl = safeCandidateCallbackUrl(String(formData.get("callbackUrl") || ""));
  const back = candidateFormBack(callbackUrl, "signin");

  if (!email || !password) flashRedirect(back, "Email and password are required.");

  await completeCandidateSignIn(email, password, callbackUrl, () =>
    flashRedirect(back, "Invalid email or password."),
  );
}

export async function logoutCandidate() {
  await candidateSignOut({ redirectTo: "/careers" });
}

export async function updateCandidateProfile(formData: FormData) {
  const me = await requireCandidateSession({ callbackUrl: "/careers/portal/profile" });
  const fullName = String(formData.get("fullName") || "").trim();
  const phone = nu(String(formData.get("phone") || ""));
  const candidateLocation = nu(String(formData.get("candidateLocation") || ""));

  if (!fullName) flashRedirect("/careers/portal/profile", "Name is required.");

  const existing = await prisma.hiringCandidate.findUnique({
    where: { id: me.candidateId },
    select: { resumeUrl: true, portfolioUrl: true },
  });

  const { resumeUrl, resumeText, error: resumeErr } = await mergeResumeUpload(
    formData,
    existing?.resumeUrl ?? null,
  );
  if (resumeErr) flashRedirect("/careers/portal/profile", resumeErr);

  const portfolioUrl = normalizeOptionalHttpUrl(formData.get("portfolioUrl"));
  if (portfolioUrl === "INVALID") {
    flashRedirect("/careers/portal/profile", "Portfolio must be a valid http(s) link, or leave it blank.");
  }

  await prisma.hiringCandidate.update({
    where: { id: me.candidateId },
    data: {
      fullName,
      phone,
      candidateLocation,
      resumeUrl,
      portfolioUrl,
      ...(resumeText
        ? { resumeExtractedText: resumeText, resumeParsedAt: new Date() }
        : {}),
    },
  });

  invalidateCandidatePaths();
  redirect("/careers/portal/profile?saved=1");
}

export async function applyToJob(jobId: string, formData: FormData) {
  const applyPath = `/careers/${jobId}/apply`;
  const me = await requireCandidateSession({ callbackUrl: applyPath });

  const openJob = await prisma.hiringJob.findFirst({
    where: hiringJobAcceptingPublicApplications(jobId),
    select: {
      id: true,
      title: true,
      applicationQuestions: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!openJob) flashRedirect(`/careers/${jobId}`, "This role is no longer accepting applications.");

  const existingApp = await prisma.hiringApplication.findUnique({
    where: { jobId_candidateId: { jobId, candidateId: me.candidateId } },
    select: { id: true },
  });
  if (existingApp) {
    redirect("/careers/portal/applications?already=1");
  }

  const candidate = await prisma.hiringCandidate.findUnique({
    where: { id: me.candidateId },
    select: { resumeUrl: true, portfolioUrl: true, fullName: true },
  });

  const fullName = String(formData.get("fullName") || "").trim() || candidate?.fullName || me.fullName;
  const phone = nu(String(formData.get("phone") || ""));
  const candidateLocation = nu(String(formData.get("candidateLocation") || ""));

  const portfolioUrl = normalizeOptionalHttpUrl(formData.get("portfolioUrl"));
  if (portfolioUrl === "INVALID") {
    flashRedirect(applyPath, "Portfolio must be a valid http(s) link, or leave it blank.");
  }

  const { resumeUrl, resumeText, error: resumeErr } = await mergeResumeUpload(
    formData,
    candidate?.resumeUrl ?? null,
  );
  if (resumeErr) flashRedirect(applyPath, resumeErr);
  if (!resumeUrl) flashRedirect(applyPath, "Upload a résumé (PDF, DOC, or DOCX) to apply.");

  const { answers: screeningDrafts, error: questionsErr } = collectScreeningAnswersFromForm(
    formData,
    openJob.applicationQuestions,
  );
  if (questionsErr) flashRedirect(applyPath, questionsErr);

  const persistedAnswers: {
    questionId: string;
    prompt: string;
    type: (typeof screeningDrafts)[number]["type"];
    textValue: string | null;
    fileUrl: string | null;
    fileName: string | null;
  }[] = [];

  for (const draft of screeningDrafts) {
    if (draft.file) {
      const uploaded = await persistHiringUploadFile(draft.file);
      if (uploaded === "TOO_LARGE") flashRedirect(applyPath, `File for “${draft.prompt}” is too large (max 12 MB).`);
      if (uploaded === "UNSUPPORTED_TYPE") {
        flashRedirect(applyPath, `File for “${draft.prompt}” must be PDF, Word, image, zip, or slides.`);
      }
      persistedAnswers.push({
        questionId: draft.questionId,
        prompt: draft.prompt,
        type: draft.type,
        textValue: null,
        fileUrl: uploaded.url,
        fileName: uploaded.fileName,
      });
    } else if (draft.textValue) {
      persistedAnswers.push({
        questionId: draft.questionId,
        prompt: draft.prompt,
        type: draft.type,
        textValue: draft.textValue,
        fileUrl: null,
        fileName: null,
      });
    }
  }

  let applicationId: string | null = null;

  try {
    applicationId = await prisma.$transaction(async (tx) => {
      await tx.hiringCandidate.update({
        where: { id: me.candidateId },
        data: {
          fullName,
          phone,
          candidateLocation,
          resumeUrl,
          portfolioUrl: portfolioUrl ?? candidate?.portfolioUrl ?? null,
          source: SELF_SIGNUP_SOURCE,
          ...(resumeText
            ? { resumeExtractedText: resumeText, resumeParsedAt: new Date() }
            : {}),
        },
      });

      const app = await createHiringApplicationInTxn(tx, {
        jobId,
        candidateId: me.candidateId,
        applicationSource: SELF_SIGNUP_SOURCE,
        actorUserId: null,
        resumeText,
      });

      if (persistedAnswers.length > 0) {
        await tx.hiringApplicationQuestionAnswer.createMany({
          data: persistedAnswers.map((a) => ({
            applicationId: app.id,
            questionId: a.questionId,
            prompt: a.prompt,
            type: a.type,
            textValue: a.textValue,
            fileUrl: a.fileUrl,
            fileName: a.fileName,
          })),
        });
      }

      return app.id;
    });
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      redirect("/careers/portal/applications?already=1");
    }
    if (e instanceof Error && e.message === "JOB_NOT_OPEN") {
      flashRedirect(`/careers/${jobId}`, "This role is no longer accepting applications.");
    }
    flashRedirect(applyPath, "Could not submit your application. Try again.");
  }

  invalidateCandidatePaths(jobId);
  if (!applicationId) flashRedirect(applyPath, "Could not submit your application. Try again.");
  redirect(`/careers/portal/applications/${applicationId}/assessment?applied=1`);
}

export async function submitApplicationAssessment(applicationId: string, formData: FormData) {
  const path = `/careers/portal/applications/${applicationId}/assessment`;
  const me = await requireCandidateSession({ callbackUrl: path });

  const app = await prisma.hiringApplication.findFirst({
    where: { id: applicationId, candidateId: me.candidateId },
    include: {
      pipelineStage: { select: { id: true, key: true, label: true, isHired: true, isRejected: true } },
      job: { select: { id: true, title: true, department: { select: { name: true } } } },
      assessment: { select: { id: true } },
    },
  });
  if (!app) flashRedirect("/careers/portal/applications", "Application not found.");
  if (app.assessment) {
    redirect(`${path}?already=1`);
  }
  if (!assessmentEligible(app.pipelineStage)) {
    flashRedirect("/careers/portal/applications", "This application is no longer open for the assessment.");
  }

  const questions = buildAssessmentQuestions({
    title: app.job.title,
    departmentName: app.job.department?.name ?? null,
  });
  const answers = collectAssessmentAnswersFromForm(formData, questions);
  const { error, responses } = validateAssessmentAnswers(questions, answers);
  if (error) flashRedirect(path, error);

  const dimensionScores = scorePsychometricDimensions(questions, answers);
  const psychometricStageId = await findPsychometricPipelineStageId();
  const shouldMove =
    Boolean(psychometricStageId) &&
    app.pipelineStage.key === "APPLIED" &&
    psychometricStageId !== app.pipelineStageId;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.hiringApplicationAssessment.create({
        data: {
          applicationId: app.id,
          responsesJson: responsesToJson(responses),
          dimensionScoresJson: dimensionScores,
        },
      });

      if (shouldMove && psychometricStageId) {
        await tx.hiringApplication.update({
          where: { id: app.id },
          data: { pipelineStageId: psychometricStageId },
        });
        await tx.hiringActivity.create({
          data: {
            kind: "APPLICATION_STAGE_CHANGED",
            summary: `${me.fullName} completed the psychometric stage for ${app.job.title} (${app.pipelineStage.label} → Psychometric)`,
            payloadJson: JSON.stringify({
              fromStageId: app.pipelineStageId,
              toStageId: psychometricStageId,
              fromLabel: app.pipelineStage.label,
              toLabel: "Psychometric",
              byCandidate: true,
              afterAssessment: true,
            }),
            candidateId: me.candidateId,
            applicationId: app.id,
          },
        });
      }

      await tx.hiringActivity.create({
        data: {
          kind: "APPLICATION_ASSESSMENT_SUBMITTED",
          summary: `${me.fullName} submitted the personality + role assessment for ${app.job.title}`,
          payloadJson: JSON.stringify({
            questionCount: responses.length,
            dimensionScores,
          }),
          candidateId: me.candidateId,
          applicationId: app.id,
        },
      });
    });
  } catch (e) {
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code?: string }).code === "P2002"
    ) {
      redirect(`${path}?already=1`);
    }
    flashRedirect(path, "Could not save your assessment. Try again.");
  }

  invalidateCandidatePaths(app.job.id);
  revalidatePath(path);
  revalidatePath(`/hiring/applications/${app.id}`);
  redirect(`${path}?submitted=1`);
}

export async function withdrawApplication(applicationId: string) {
  const me = await requireCandidateSession({ callbackUrl: "/careers/portal/applications" });

  const app = await prisma.hiringApplication.findFirst({
    where: { id: applicationId, candidateId: me.candidateId },
    include: {
      pipelineStage: { select: { key: true, isHired: true, isRejected: true, label: true } },
      job: { select: { id: true, title: true } },
    },
  });
  if (!app) flashRedirect("/careers/portal/applications", "Application not found.");

  if (app.pipelineStage.key === "WITHDRAWN" || app.pipelineStage.isHired) {
    flashRedirect(
      "/careers/portal/applications",
      app.pipelineStage.isHired
        ? "This application can no longer be withdrawn."
        : "You already withdrew this application.",
    );
  }

  const withdrawnId = await findWithdrawnPipelineStageId();
  if (!withdrawnId) {
    flashRedirect(
      "/careers/portal/applications",
      "Withdrawals aren’t configured yet — contact the hiring team.",
    );
  }

  const beforeLabel = app.pipelineStage.label;

  await prisma.$transaction(async (tx) => {
    await tx.hiringApplication.update({
      where: { id: app.id },
      data: { pipelineStageId: withdrawnId },
    });
    await tx.hiringActivity.create({
      data: {
        kind: "APPLICATION_STAGE_CHANGED",
        summary: `${me.fullName} withdrew from ${app.job.title} (${beforeLabel} → Withdrawn)`,
        payloadJson: JSON.stringify({
          fromStageId: app.pipelineStageId,
          toStageId: withdrawnId,
          fromLabel: beforeLabel,
          toLabel: "Withdrawn",
          byCandidate: true,
        }),
        candidateId: me.candidateId,
        applicationId: app.id,
      },
    });
  });

  invalidateCandidatePaths(app.job.id);
  redirect("/careers/portal/applications?withdrawn=1");
}
