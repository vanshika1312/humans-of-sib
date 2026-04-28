"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createOneOnOne(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const me = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!me) throw new Error("User not found");

  const reportId = String(formData.get("reportId"));
  const scheduledAt = new Date(String(formData.get("scheduledAt")));
  const agenda = String(formData.get("agenda") || "").trim() || null;

  await prisma.oneOnOne.create({
    data: { managerId: me.id, reportId, scheduledAt, agenda },
  });

  revalidatePath("/one-on-one");
}

export async function saveOneOnOne(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const me = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!me) throw new Error("User not found");

  const existing = await prisma.oneOnOne.findUnique({ where: { id } });
  if (!existing || (existing.managerId !== me.id && existing.reportId !== me.id)) throw new Error("Forbidden");

  await prisma.oneOnOne.update({
    where: { id },
    data: {
      notes: String(formData.get("notes") || "") || null,
      actionItems: formData.get("actionItems") ? JSON.parse(String(formData.get("actionItems"))) : undefined,
      completed: formData.get("completed") === "on",
    },
  });

  revalidatePath("/one-on-one");
}
