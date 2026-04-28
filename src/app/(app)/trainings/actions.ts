"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function enrollInTraining(trainingId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  await prisma.trainingEnrollment.upsert({
    where: { userId_trainingId: { userId: user.id, trainingId } },
    update: { status: "IN_PROGRESS", startedAt: new Date() },
    create: { userId: user.id, trainingId, status: "IN_PROGRESS", startedAt: new Date() },
  });

  revalidatePath("/trainings");
  revalidatePath("/home");
}

export async function markTrainingComplete(trainingId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const score = Number(formData.get("score") || 0);
  const training = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!training) throw new Error("Training not found");
  const pass = score >= (training.passingScore || 70);

  await prisma.trainingEnrollment.update({
    where: { userId_trainingId: { userId: user.id, trainingId } },
    data: {
      status: pass ? "COMPLETED" : "FAILED",
      score,
      progress: 100,
      completedAt: new Date(),
    },
  });

  if (pass) {
    const count = await prisma.certificate.count();
    await prisma.certificate.create({
      data: {
        userId: user.id,
        trainingId,
        number: `SIB-CERT-${String(count + 1).padStart(5, "0")}`,
      },
    });
    await prisma.journeyEvent.create({
      data: {
        userId: user.id,
        type: "TRAINING_COMPLETED",
        title: `Completed: ${training.title}`,
        description: `Scored ${score}%. Certificate earned.`,
        emoji: "🎓",
      },
    });
  }

  revalidatePath("/trainings");
  revalidatePath("/journey");
}
