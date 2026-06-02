import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

async function nextCertificateNumber(tx: Prisma.TransactionClient) {
  const count = await tx.certificate.count();
  return `SIB-CERT-${String(count + 1).padStart(5, "0")}`;
}

export async function completeTrainingAfterQuizPass(opts: {
  userId: string;
  trainingId: string;
  trainingTitle: string;
  pointsAwarded: number;
  score: number;
}) {
  const { userId, trainingId, trainingTitle, pointsAwarded, score } = opts;

  return prisma.$transaction(async (tx) => {
    await tx.trainingEnrollment.upsert({
      where: { userId_trainingId: { userId, trainingId } },
      update: {
        status: "COMPLETED",
        score,
        progress: 100,
        completedAt: new Date(),
      },
      create: {
        userId,
        trainingId,
        status: "COMPLETED",
        score,
        progress: 100,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const existingCert = await tx.certificate.findFirst({
      where: { userId, trainingId },
    });

    let certificate = existingCert;
    if (!certificate) {
      certificate = await tx.certificate.create({
        data: {
          userId,
          trainingId,
          number: await nextCertificateNumber(tx),
        },
      });
    }

    const existingWin = await tx.win.findFirst({
      where: { userId, trainingId },
    });

    if (!existingWin) {
      await tx.win.create({
        data: {
          userId,
          trainingId,
          title: `Completed: ${trainingTitle}`,
          description: `Earned ${pointsAwarded} learning points`,
          category: "LEARNING",
          source: "TRAINING",
          rewardType: "NONE",
          pointsAwarded,
        },
      });
    }

    const existingJourney = await tx.journeyEvent.findFirst({
      where: { userId, type: "TRAINING_COMPLETED", title: `Completed: ${trainingTitle}` },
    });

    if (!existingJourney) {
      await tx.journeyEvent.create({
        data: {
          userId,
          type: "TRAINING_COMPLETED",
          title: `Completed: ${trainingTitle}`,
          description: `Scored ${score}%. Certificate earned.`,
          emoji: "🎓",
        },
      });
    }

    return { certificate, pointsAwarded, alreadyCompleted: !!existingCert && !!existingWin };
  });
}
