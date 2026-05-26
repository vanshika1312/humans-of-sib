"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PULSE_ADMIN_ROLES, calendarDateToParam, parseWeekStartParam } from "@/lib/pulse";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requirePulseAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !(PULSE_ADMIN_ROLES as readonly string[]).includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function setPulseWeekQuestion(formData: FormData) {
  await requirePulseAdmin();

  const weekRaw = String(formData.get("weekStart") || "");
  const weekStart = parseWeekStartParam(weekRaw || undefined);
  const question = String(formData.get("question") || "").trim();
  const promptLabel = String(formData.get("promptLabel") || "").trim() || null;

  if (question.length < 8) throw new Error("Question is too short");
  if (question.length > 500) throw new Error("Question is too long");

  await prisma.pulseWeek.upsert({
    where: { weekStart },
    update: { question, promptLabel },
    create: { weekStart, question, promptLabel },
  });

  revalidatePath("/admin/pulse");
  revalidatePath("/pulse");
  revalidatePath("/home");
  redirect(`/admin/pulse?week=${calendarDateToParam(weekStart)}&saved=1`);
}
