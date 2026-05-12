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
  if (!session?.user?.email) redirect("/sign-in");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) redirect("/sign-in");

  const parsed = schema.safeParse({
    subject: formData.get("subject"),
    message: formData.get("message"),
    category: formData.get("category"),
    anonymous: formData.get("anonymous") || false,
  });
  if (!parsed.success) {
    const err = parsed.error.flatten();
    const hint =
      err.fieldErrors.subject?.[0] ||
      err.fieldErrors.message?.[0] ||
      err.fieldErrors.category?.[0] ||
      err.formErrors[0] ||
      "Please check subject and message (minimum lengths apply).";
    redirect("/feedback/ceo/new?error=" + encodeURIComponent(hint));
  }

  try {
    await prisma.cEOFeedback.create({
      data: {
        subject: parsed.data.subject,
        message: parsed.data.message,
        category: parsed.data.category,
        anonymous: parsed.data.anonymous,
        userId: parsed.data.anonymous ? null : user.id,
      },
    });
  } catch {
    redirect("/feedback/ceo/new?error=" + encodeURIComponent("Could not send your message. Try again in a moment."));
  }

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
