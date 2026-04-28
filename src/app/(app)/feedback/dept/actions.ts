"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  toDepartmentId: z.string().min(1),
  type: z.enum(["KUDOS", "CONSTRUCTIVE", "REQUEST"]),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(3000),
  isPublic: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export async function submitDeptFeedback(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const parsed = schema.parse({
    toDepartmentId: formData.get("toDepartmentId"),
    type: formData.get("type"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    isPublic: formData.get("isPublic") || false,
  });

  await prisma.deptFeedback.create({
    data: {
      fromUserId: user.id,
      ...parsed,
    },
  });

  revalidatePath("/feedback/dept");
}
