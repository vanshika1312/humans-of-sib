"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const winSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  tags: z.string().max(200).optional(),
});

export async function createWin(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const parsed = winSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    tags: formData.get("tags") || undefined,
  });

  const tags = parsed.tags
    ? parsed.tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean).slice(0, 6)
    : [];

  await prisma.$transaction([
    prisma.win.create({
      data: {
        userId: user.id,
        title: parsed.title,
        description: parsed.description,
        tags,
      },
    }),
    prisma.journeyEvent.create({
      data: {
        userId: user.id,
        type: "WIN",
        title: parsed.title,
        description: parsed.description,
        emoji: "🏆",
      },
    }),
  ]);

  revalidatePath("/wins");
  revalidatePath("/home");
  revalidatePath("/journey");
}

export async function toggleClap(winId: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const existing = await prisma.winClap.findUnique({
    where: { winId_userId: { winId, userId: user.id } },
  });

  if (existing) {
    await prisma.winClap.delete({ where: { id: existing.id } });
  } else {
    await prisma.winClap.create({ data: { winId, userId: user.id } });
  }
  revalidatePath("/wins");
  revalidatePath("/home");
}
