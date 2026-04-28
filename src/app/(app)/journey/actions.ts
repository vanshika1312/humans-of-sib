"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  type: z.enum(["MILESTONE", "PROMOTION", "AWARD", "WIN", "TRAINING_COMPLETED", "ANNIVERSARY", "CUSTOM"]),
  title: z.string().min(2).max(140),
  description: z.string().max(1000).optional(),
  emoji: z.string().max(4).optional(),
  occurredAt: z.string().optional(),
});

export async function addJourneyEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const parsed = schema.parse({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    emoji: formData.get("emoji") || undefined,
    occurredAt: formData.get("occurredAt") || undefined,
  });

  await prisma.journeyEvent.create({
    data: {
      userId: user.id,
      type: parsed.type,
      title: parsed.title,
      description: parsed.description,
      emoji: parsed.emoji,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
    },
  });

  revalidatePath("/journey");
}
