"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  employeeSelfProfileToDb,
  parseEmployeeSelfProfileForm,
} from "@/lib/employee-self-profile";

export async function completeEmployeeOnboarding(fd: FormData) {
  const token = String(fd.get("inviteToken") ?? "").trim();
  if (!token) redirect("/sign-in?error=invalid_invite");

  const parsed = parseEmployeeSelfProfileForm(fd);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "invalid";
    redirect(`/onboarding/${encodeURIComponent(token)}?error=${encodeURIComponent(msg)}`);
  }

  const now = new Date();
  const v = parsed.data;

  const existing = await prisma.user.findFirst({
    where: {
      onboardingInviteToken: token,
      invitationPending: true,
      onboardingInviteExpiresAt: { gt: now },
    },
    select: { id: true },
  });

  if (!existing) {
    redirect("/sign-in?error=invalid_invite");
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...employeeSelfProfileToDb(v),
      updatedAt: now,
    },
  });

  redirect("/sign-in?notice=onboarding_done");
}
