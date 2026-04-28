"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const bio = String(formData.get("bio") || "").slice(0, 500) || null;
  const phone = String(formData.get("phone") || "").slice(0, 20) || null;
  const title = String(formData.get("title") || "").slice(0, 100) || null;
  const bday = String(formData.get("birthday") || "");
  const birthday = bday ? new Date(bday) : undefined;

  await prisma.user.update({
    where: { id: user.id },
    data: { bio, phone, title, birthday },
  });

  revalidatePath("/me");
  revalidatePath("/home");
}
