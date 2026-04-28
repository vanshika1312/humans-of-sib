"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  cycle: z.enum(["YEAR", "QUARTER", "MONTH"]),
  year: z.coerce.number().int().min(2020).max(2100),
  quarter: z.coerce.number().int().min(1).max(4).optional().nullable(),
  month: z.coerce.number().int().min(1).max(12).optional().nullable(),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  parentId: z.string().optional().nullable(),
});

export async function createOkr(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const parsed = schema.parse({
    cycle: formData.get("cycle"),
    year: formData.get("year"),
    quarter: formData.get("quarter") || null,
    month: formData.get("month") || null,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    parentId: formData.get("parentId") || null,
  });

  await prisma.oKR.create({
    data: {
      userId: user.id,
      cycle: parsed.cycle,
      year: parsed.year,
      quarter: parsed.cycle === "YEAR" ? null : parsed.quarter,
      month: parsed.cycle === "MONTH" ? parsed.month : null,
      title: parsed.title,
      description: parsed.description,
      parentId: parsed.parentId || null,
    },
  });

  revalidatePath("/okrs");
  revalidatePath("/home");
}

export async function updateOkrProgress(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const progress = Math.min(100, Math.max(0, Number(formData.get("progress") || 0)));
  const status = String(formData.get("status") || "ON_TRACK") as any;

  const okr = await prisma.oKR.findUnique({ where: { id } });
  if (!okr || okr.userId !== user.id) throw new Error("Forbidden");

  await prisma.oKR.update({
    where: { id },
    data: { progress, status: progress === 100 ? "COMPLETED" : status },
  });

  revalidatePath("/okrs");
}
