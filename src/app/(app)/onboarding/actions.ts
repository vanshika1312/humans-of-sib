"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function toggleOnboardingTask(id: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const t = await prisma.onboardingTask.findUnique({ where: { id } });
  if (!t || t.userId !== user.id) throw new Error("Forbidden");

  await prisma.onboardingTask.update({
    where: { id },
    data: { completed: !t.completed, completedAt: !t.completed ? new Date() : null },
  });
  revalidatePath("/onboarding");
}
