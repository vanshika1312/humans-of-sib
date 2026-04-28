"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { weekStartDate } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { WEEKLY_QUESTION } from "./constants";

export async function submitPulse(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const score = Number(formData.get("score"));
  const comment = String(formData.get("comment") || "").trim() || undefined;
  if (!(score >= 1 && score <= 5)) throw new Error("Invalid score");

  const weekStart = weekStartDate();

  await prisma.pulseResponse.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    update: { score, comment, question: WEEKLY_QUESTION },
    create: { userId: user.id, weekStart, score, comment, question: WEEKLY_QUESTION },
  });

  revalidatePath("/pulse");
  revalidatePath("/home");
}
