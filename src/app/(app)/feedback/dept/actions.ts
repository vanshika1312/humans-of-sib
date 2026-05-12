"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { departmentIdFromForm } from "@/lib/department-resolve";

const schema = z.object({
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

  const toDepartmentId = await departmentIdFromForm(prisma, formData, "toDepartmentName");
  if (!toDepartmentId) {
    throw new Error("Pick from the list or type a department name.");
  }

  const parsed = schema.parse({
    type: formData.get("type"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    isPublic: formData.get("isPublic") || false,
  });

  await prisma.deptFeedback.create({
    data: {
      fromUserId: user.id,
      toDepartmentId,
      ...parsed,
    },
  });

  revalidatePath("/feedback/dept");
}
