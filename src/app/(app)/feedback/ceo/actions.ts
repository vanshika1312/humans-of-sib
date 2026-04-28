"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
  category: z.enum(["IDEA", "CONCERN", "KUDOS", "BUG", "PROCESS", "OTHER"]),
  anonymous: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export async function submitCeoFeedback(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const parsed = schema.parse({
    subject: formData.get("subject"),
    message: formData.get("message"),
    category: formData.get("category"),
    anonymous: formData.get("anonymous") || false,
  });

  await prisma.cEOFeedback.create({
    data: {
      subject: parsed.subject,
      message: parsed.message,
      category: parsed.category,
      anonymous: parsed.anonymous,
      userId: parsed.anonymous ? null : user.id,
    },
  });

  revalidatePath("/feedback/ceo");
  redirect("/feedback/ceo?sent=1");
}

export async function respondCeoFeedback(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !["CEO", "ADMIN"].includes(user.role)) throw new Error("Forbidden");

  const response = String(formData.get("response") || "").trim();
  const status = String(formData.get("status") || "ACKNOWLEDGED") as any;

  await prisma.cEOFeedback.update({
    where: { id },
    data: {
      response: response || null,
      status,
      respondedAt: response ? new Date() : undefined,
      respondedById: response ? user.id : undefined,
    },
  });
  revalidatePath("/feedback/ceo/inbox");
  revalidatePath("/feedback/ceo");
}
