"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { canManageTrainingLibrary, MIN_QUIZ_QUESTIONS } from "@/lib/training-admin";
import { persistTrainingContentFile } from "@/lib/training-content-upload";
import { parseQuizQuestionsJson, validateQuizQuestions } from "@/lib/training-quiz";
import type { TrainingType } from "@/generated/prisma";

const trainingTypes = [
  "READING",
  "EXTERNAL_COURSE",
  "SELF_PACED",
  "LIVE",
  "WORKSHOP",
] as const satisfies readonly TrainingType[];

const baseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  type: z.enum(trainingTypes),
  category: z.string().trim().max(80).optional(),
  coverImage: z.string().trim().max(2048).optional(),
  durationMin: z.coerce.number().int().min(0).max(10000).optional(),
  passingScore: z.coerce.number().int().min(0).max(100).optional(),
  pointsAwarded: z.coerce.number().int().min(0).max(10000).optional(),
  isPublished: z.coerce.boolean().optional(),
  author: z.string().trim().max(200).optional(),
  externalUrl: z.string().trim().max(2048).optional(),
  provider: z.string().trim().max(120).optional(),
  contentUrl: z.string().trim().max(2048).optional(),
  quizJson: z.string().optional(),
});

async function requireAdmin() {
  const me = await requireAppViewer();
  if (!canManageTrainingLibrary(me)) throw new Error("Forbidden");
  return me!;
}

async function replaceQuizQuestions(trainingId: string, quizJson: string | undefined) {
  const questions = parseQuizQuestionsJson(quizJson ?? "[]");
  await prisma.$transaction(async (tx) => {
    await tx.trainingQuestion.deleteMany({ where: { trainingId } });
    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx]!;
      await tx.trainingQuestion.create({
        data: {
          trainingId,
          prompt: q.prompt,
          sortOrder: idx,
          options: {
            create: q.options.map((o) => ({
              label: o.label,
              isCorrect: o.isCorrect,
            })),
          },
        },
      });
    }
  });
}

function trainingValidationError(
  type: TrainingType,
  data: z.infer<typeof baseSchema>,
  questions: ReturnType<typeof parseQuizQuestionsJson>,
  publishing: boolean,
): string | null {
  if (type === "READING" && !data.contentUrl?.trim() && !data.author?.trim()) {
    // allow author-only draft; require PDF for publish
    if (publishing && !data.contentUrl?.trim()) {
      return "Upload a PDF before publishing a book.";
    }
  }
  if (type === "EXTERNAL_COURSE") {
    if (publishing && !data.externalUrl?.trim()) {
      return "Add an external course URL before publishing.";
    }
  }
  if (publishing) {
    return validateQuizQuestions(questions, MIN_QUIZ_QUESTIONS);
  }
  return null;
}

export async function createTraining(formData: FormData) {
  await requireAdmin();

  const parsed = baseSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    type: formData.get("type"),
    category: formData.get("category") || undefined,
    coverImage: formData.get("coverImage") || undefined,
    durationMin: formData.get("durationMin") || undefined,
    passingScore: formData.get("passingScore") || undefined,
    pointsAwarded: formData.get("pointsAwarded") || undefined,
    isPublished: formData.get("isPublished") === "on" || formData.get("isPublished") === "true",
    author: formData.get("author") || undefined,
    externalUrl: formData.get("externalUrl") || undefined,
    provider: formData.get("provider") || undefined,
    contentUrl: formData.get("contentUrl") || undefined,
    quizJson: formData.get("quizJson") || undefined,
  });

  const pdfFile = formData.get("pdfFile");
  let contentUrl = parsed.contentUrl?.trim() || undefined;
  if (pdfFile instanceof File && pdfFile.size > 0) {
    const uploaded = await persistTrainingContentFile(pdfFile);
    if (!uploaded.ok) {
      redirect(`/admin/trainings/new?error=upload-${uploaded.code.toLowerCase()}`);
    }
    contentUrl = uploaded.url;
  }

  const questions = parseQuizQuestionsJson(parsed.quizJson ?? "[]");
  const publishing = parsed.isPublished ?? false;
  const validationError = trainingValidationError(parsed.type, { ...parsed, contentUrl }, questions, publishing);
  if (validationError) {
    redirect(`/admin/trainings/new?error=${encodeURIComponent(validationError)}`);
  }

  const training = await prisma.training.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      type: parsed.type,
      category: parsed.category,
      coverImage: parsed.coverImage,
      durationMin: parsed.durationMin,
      passingScore: parsed.passingScore ?? 70,
      pointsAwarded: parsed.pointsAwarded ?? 50,
      isPublished: publishing,
      author: parsed.author,
      externalUrl: parsed.externalUrl,
      provider: parsed.provider,
      contentUrl,
    },
  });

  await replaceQuizQuestions(training.id, parsed.quizJson);

  revalidatePath("/admin/trainings");
  revalidatePath("/trainings");
  redirect(`/admin/trainings/${training.id}?saved=1`);
}

export async function updateTraining(trainingId: string, formData: FormData) {
  await requireAdmin();

  const existing = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!existing) redirect("/admin/trainings?error=not-found");

  const parsed = baseSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    type: formData.get("type"),
    category: formData.get("category") || undefined,
    coverImage: formData.get("coverImage") || undefined,
    durationMin: formData.get("durationMin") || undefined,
    passingScore: formData.get("passingScore") || undefined,
    pointsAwarded: formData.get("pointsAwarded") || undefined,
    isPublished: formData.get("isPublished") === "on" || formData.get("isPublished") === "true",
    author: formData.get("author") || undefined,
    externalUrl: formData.get("externalUrl") || undefined,
    provider: formData.get("provider") || undefined,
    contentUrl: formData.get("contentUrl") || undefined,
    quizJson: formData.get("quizJson") || undefined,
  });

  const pdfFile = formData.get("pdfFile");
  let contentUrl = parsed.contentUrl?.trim() || existing.contentUrl || undefined;
  if (pdfFile instanceof File && pdfFile.size > 0) {
    const uploaded = await persistTrainingContentFile(pdfFile);
    if (!uploaded.ok) {
      redirect(`/admin/trainings/${trainingId}?error=upload-${uploaded.code.toLowerCase()}`);
    }
    contentUrl = uploaded.url;
  }

  const questions = parseQuizQuestionsJson(parsed.quizJson ?? "[]");
  const publishing = parsed.isPublished ?? false;
  const validationError = trainingValidationError(parsed.type, { ...parsed, contentUrl }, questions, publishing);
  if (validationError) {
    redirect(`/admin/trainings/${trainingId}?error=${encodeURIComponent(validationError)}`);
  }

  await prisma.training.update({
    where: { id: trainingId },
    data: {
      title: parsed.title,
      description: parsed.description,
      type: parsed.type,
      category: parsed.category,
      coverImage: parsed.coverImage,
      durationMin: parsed.durationMin,
      passingScore: parsed.passingScore ?? 70,
      pointsAwarded: parsed.pointsAwarded ?? 50,
      isPublished: publishing,
      author: parsed.author,
      externalUrl: parsed.externalUrl,
      provider: parsed.provider,
      contentUrl,
    },
  });

  if (parsed.quizJson) {
    await replaceQuizQuestions(trainingId, parsed.quizJson);
  }

  revalidatePath("/admin/trainings");
  revalidatePath("/trainings");
  revalidatePath(`/trainings/${trainingId}`);
  redirect(`/admin/trainings/${trainingId}?saved=1`);
}

export async function deleteTraining(trainingId: string) {
  await requireAdmin();
  await prisma.training.delete({ where: { id: trainingId } });
  revalidatePath("/admin/trainings");
  revalidatePath("/trainings");
  redirect("/admin/trainings?deleted=1");
}

export async function toggleTrainingPublished(trainingId: string, published: boolean) {
  await requireAdmin();
  if (published) {
    const training = await prisma.training.findUnique({
      where: { id: trainingId },
      include: { questions: { include: { options: true } } },
    });
    if (!training) throw new Error("Not found");
    const questions = training.questions.map((q) => ({
      prompt: q.prompt,
      options: q.options.map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
    }));
    const err = trainingValidationError(
      training.type,
      {
        title: training.title,
        type: training.type,
        contentUrl: training.contentUrl ?? undefined,
        externalUrl: training.externalUrl ?? undefined,
        author: training.author ?? undefined,
      },
      questions,
      true,
    );
    if (err) throw new Error(err);
  }
  await prisma.training.update({
    where: { id: trainingId },
    data: { isPublished: published },
  });
  revalidatePath("/admin/trainings");
  revalidatePath("/trainings");
}
