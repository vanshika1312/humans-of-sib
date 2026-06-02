"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { gradeTrainingQuiz, type QuizAnswerMap } from "@/lib/training-quiz";
import { completeTrainingAfterQuizPass } from "@/lib/training-completion";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");
  return user;
}

function revalidateTrainingPaths() {
  revalidatePath("/trainings");
  revalidatePath("/home");
  revalidatePath("/journey");
  revalidatePath("/wins");
}

export async function enrollInTraining(trainingId: string) {
  const user = await requireUser();

  const training = await prisma.training.findFirst({
    where: { id: trainingId, isPublished: true },
  });
  if (!training) throw new Error("Training not found");

  const existing = await prisma.trainingEnrollment.findUnique({
    where: { userId_trainingId: { userId: user.id, trainingId } },
  });
  if (existing?.status === "COMPLETED") return;

  await prisma.trainingEnrollment.upsert({
    where: { userId_trainingId: { userId: user.id, trainingId } },
    update: { status: "IN_PROGRESS", startedAt: existing?.startedAt ?? new Date() },
    create: { userId: user.id, trainingId, status: "IN_PROGRESS", startedAt: new Date() },
  });

  revalidateTrainingPaths();
}

export type SubmitQuizResult =
  | { ok: true; passed: true; score: number; certId: string; certNumber: string; pointsAwarded: number }
  | { ok: true; passed: false; score: number; passThreshold: number }
  | { ok: false; error: string };

export async function submitTrainingQuiz(
  trainingId: string,
  answers: QuizAnswerMap,
): Promise<SubmitQuizResult> {
  const user = await requireUser();

  const training = await prisma.training.findFirst({
    where: { id: trainingId, isPublished: true },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        include: { options: true },
      },
    },
  });

  if (!training) return { ok: false, error: "Training not found." };
  if (training.questions.length === 0) {
    return { ok: false, error: "This training has no quiz yet." };
  }

  const existingEnrollment = await prisma.trainingEnrollment.findUnique({
    where: { userId_trainingId: { userId: user.id, trainingId } },
  });
  if (existingEnrollment?.status === "COMPLETED") {
    const cert = await prisma.certificate.findFirst({
      where: { userId: user.id, trainingId },
    });
    if (cert) {
      return {
        ok: true,
        passed: true,
        score: existingEnrollment.score ?? 100,
        certId: cert.id,
        certNumber: cert.number,
        pointsAwarded: training.pointsAwarded,
      };
    }
  }

  const passThreshold = training.passingScore ?? 70;
  const { score, passed } = gradeTrainingQuiz(training.questions, answers, passThreshold);

  await prisma.trainingEnrollment.upsert({
    where: { userId_trainingId: { userId: user.id, trainingId } },
    update: {},
    create: { userId: user.id, trainingId, status: "IN_PROGRESS", startedAt: new Date() },
  });

  await prisma.trainingQuizAttempt.create({
    data: {
      userId: user.id,
      trainingId,
      score,
      passed,
      answers,
    },
  });

  if (!passed) {
    await prisma.trainingEnrollment.update({
      where: { userId_trainingId: { userId: user.id, trainingId } },
      data: { status: "IN_PROGRESS", score },
    });
    revalidateTrainingPaths();
    revalidatePath(`/trainings/${trainingId}`);
    return { ok: true, passed: false, score, passThreshold };
  }

  const result = await completeTrainingAfterQuizPass({
    userId: user.id,
    trainingId,
    trainingTitle: training.title,
    pointsAwarded: training.pointsAwarded,
    score,
  });

  revalidateTrainingPaths();
  revalidatePath(`/trainings/${trainingId}`);

  return {
    ok: true,
    passed: true,
    score,
    certId: result.certificate.id,
    certNumber: result.certificate.number,
    pointsAwarded: result.pointsAwarded,
  };
}
