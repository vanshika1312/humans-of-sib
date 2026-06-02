"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  employeeSelfProfileToDb,
  parseEmployeeSelfProfileForm,
} from "@/lib/employee-self-profile";

export async function completeMyProfile(fd: FormData) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) redirect("/sign-in");

  const parsed = parseEmployeeSelfProfileForm(fd);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Please check the form and try again.";
    redirect(`/complete-profile?error=${encodeURIComponent(msg)}`);
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) redirect("/sign-in?error=not_registered");

  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { ...employeeSelfProfileToDb(parsed.data), updatedAt: now },
  });

  revalidatePath("/complete-profile");
  revalidatePath("/me");
  revalidatePath("/home");
  revalidatePath(`/people/${user.id}`);

  redirect("/home");
}
