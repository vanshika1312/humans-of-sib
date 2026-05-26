"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { weekStartDate } from "@/lib/utils";
import { getPulseWeekConfig } from "@/lib/pulse";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function submitPulse(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const score = Number(formData.get("score"));
  const comment = String(formData.get("comment") || "").trim() || undefined;
  if (!(score >= 1 && score <= 5)) throw new Error("Invalid score");

  const weekStart = weekStartDate();
  const { question } = await getPulseWeekConfig(weekStart);

  await prisma.pulseResponse.upsert({
    where: { userId_weekStart: { userId: user.id, weekStart } },
    update: { score, comment, question },
    create: { userId: user.id, weekStart, score, comment, question },
  });

  revalidatePath("/pulse");
  revalidatePath("/home");
  redirect("/pulse?saved=1");
}
