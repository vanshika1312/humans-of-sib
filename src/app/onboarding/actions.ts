"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Gender } from "@/generated/prisma";

const formSchema = z.object({
  birthday: z.string().min(1),
  pan: z
    .string()
    .min(10)
    .max(10)
    .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/),
  aadhar: z.string().regex(/^\d{12}$/),
  fatherName: z.string().min(1).max(200),
  motherName: z.string().min(1).max(200),
  emergencyContactName: z.string().min(1).max(200),
  emergencyContactPhone: z.string().min(5).max(32),
  emergencyContactRelation: z.string().min(1).max(100),
  residentialAddress: z.string().min(3).max(2000),
  personalEmail: z.string().email(),
  cityId: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"]),
});

export async function completeEmployeeOnboarding(fd: FormData) {
  const token = String(fd.get("inviteToken") ?? "").trim();
  if (!token) redirect("/sign-in?error=invalid_invite");

  const raw = {
    birthday: fd.get("birthday"),
    pan: String(fd.get("pan") ?? "").trim().toUpperCase(),
    aadhar: String(fd.get("aadhar") ?? "").replace(/\s/g, ""),
    fatherName: fd.get("fatherName"),
    motherName: fd.get("motherName"),
    emergencyContactName: fd.get("emergencyContactName"),
    emergencyContactPhone: fd.get("emergencyContactPhone"),
    emergencyContactRelation: fd.get("emergencyContactRelation"),
    residentialAddress: fd.get("residentialAddress"),
    personalEmail: String(fd.get("personalEmail") ?? "").trim().toLowerCase(),
    cityId: fd.get("cityId"),
    gender: fd.get("gender"),
  };

  const parsed = formSchema.safeParse(raw);
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
      birthday: new Date(v.birthday),
      pan: v.pan,
      aadhar: v.aadhar,
      fatherName: v.fatherName.trim(),
      motherName: v.motherName.trim(),
      emergencyContactName: v.emergencyContactName.trim(),
      emergencyContactPhone: v.emergencyContactPhone.trim(),
      emergencyContactRelation: v.emergencyContactRelation.trim(),
      residentialAddress: v.residentialAddress.trim(),
      personalEmail: v.personalEmail,
      cityId: v.cityId,
      gender: v.gender as Gender,
      invitationPending: false,
      onboardingInviteToken: null,
      onboardingInviteExpiresAt: null,
      updatedAt: now,
    },
  });

  redirect("/sign-in?notice=onboarding_done");
}
