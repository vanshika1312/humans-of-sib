"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { EmployeeStatus, Gender, Role } from "@/generated/prisma";
import { redirect } from "next/navigation";
import {
  AdminMutationError,
  assertHrCreateRole,
  assertHrUpdateRole,
  assertNotRemovingLastWorkspaceAdmin,
  isWorkspacePowerUser,
  parseEmployeeStatus,
  parseRole,
} from "@/lib/admin-mutations";
import { sendEmployeeOnboardingInvite } from "@/lib/email";
import { allocateEmployeeCode } from "@/lib/next-employee-code";
import { newOnboardingSecret, onboardingInviteExpiry } from "@/lib/onboarding-invite";
import { departmentIdFromForm } from "@/lib/department-resolve";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

async function requireAdmin() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/home");
  return me;
}

export async function createMember(fd: FormData) {
  const me = await requireAdmin();

  const email = (fd.get("email") as string)?.toLowerCase().trim();
  const firstName = (fd.get("firstName") as string)?.trim();
  const lastName = (fd.get("lastName") as string)?.trim();
  const title = (fd.get("title") as string)?.trim() || "";
  const joinedAt = fd.get("joinedAt") as string;
  const dateOfLeavingRaw = fd.get("dateOfLeaving") as string | null;
  const phone = (fd.get("phone") as string)?.trim() || "";
  const salary = fd.get("salary") as string;
  const departmentId = await departmentIdFromForm(prisma, fd);
  const managerId = (fd.get("managerId") as string)?.trim();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  let role: Role;
  let status: EmployeeStatus;

  try {
    const r = parseRole(fd.get("role"));
    if (!r) throw new AdminMutationError("invalid_role_payload");
    assertHrCreateRole(me.role, r);
    role = r;

    const s = parseEmployeeStatus(fd.get("status"));
    if (!s) throw new AdminMutationError("invalid_status_payload");
    status = s;
  } catch (e) {
    if (e instanceof AdminMutationError) {
      redirect(`/admin/team/new?notice=${encodeURIComponent(e.code)}`);
    }
    throw e;
  }

  if (!email || !firstName || !lastName) {
    redirect(`/admin/team/new?notice=${encodeURIComponent("missing_name_or_email")}`);
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const inviteSecret = newOnboardingSecret();
  const inviteExpires = onboardingInviteExpiry();

  const user = await prisma.$transaction(async (tx) => {
    const employeeCode = await allocateEmployeeCode(tx);
    return tx.user.create({
      data: {
        email,
        firstName,
        lastName,
        name: fullName,
        title: title || null,
        role,
        status,
        departmentId,
        managerId: managerId || null,
        joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
        dateOfLeaving: dateOfLeavingRaw?.trim() ? new Date(dateOfLeavingRaw) : null,
        phone: phone || null,
        employeeCode,
        invitationPending: true,
        onboardingInviteToken: inviteSecret,
        onboardingInviteExpiresAt: inviteExpires,
      },
    });
  });

  let notice: string | undefined;
  const salaryN = salary?.trim() ? parseInt(salary, 10) : NaN;

  let mailError: string | undefined;
  try {
    await sendEmployeeOnboardingInvite({
      to: user.email,
      employeeCode: user.employeeCode!,
      firstName: user.firstName!,
      inviteUrl: `${baseUrl}/onboarding/${inviteSecret}`,
    });
  } catch (err) {
    console.error("[Humans of SIB] onboarding invite email failed", err);
    mailError = (err instanceof Error ? err.message : String(err)).slice(0, 1200);
    notice = "invite_failed";
  }

  if (Number.isFinite(salaryN) && salaryN > 0) {
    if (isWorkspacePowerUser(me.role)) {
      await prisma.compensation.create({
        data: {
          userId: user.id,
          monthlySalary: salaryN,
        },
      });
    } else {
      notice = notice ?? "salary_create_blocked";
    }
  }

  const qs = new URLSearchParams();
  if (notice) qs.set("notice", notice);
  if (mailError) qs.set("mailError", mailError);
  const tail = qs.toString();
  redirect(tail ? `/admin?${tail}` : "/admin");
}

export async function resendOnboardingInvite(userId: string) {
  await requireAdmin();
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      employeeCode: true,
      invitationPending: true,
    },
  });
  if (!member || !member.invitationPending) redirect(`/admin/team/${userId}`);

  const inviteSecret = newOnboardingSecret();
  const inviteExpires = onboardingInviteExpiry();

  await prisma.user.update({
    where: { id: userId },
    data: {
      onboardingInviteToken: inviteSecret,
      onboardingInviteExpiresAt: inviteExpires,
      updatedAt: new Date(),
    },
  });

  try {
    await sendEmployeeOnboardingInvite({
      to: member.email,
      employeeCode: member.employeeCode ?? "—",
      firstName: member.firstName ?? member.name?.split(/\s+/)[0] ?? "there",
      inviteUrl: `${baseUrl}/onboarding/${inviteSecret}`,
    });
  } catch (err) {
    console.error("[Humans of SIB] resend onboarding email failed", err);
    const mailError = (err instanceof Error ? err.message : String(err)).slice(0, 1200);
    const qs = new URLSearchParams({
      notice: "invite_failed",
      mailError,
    });
    redirect(`/admin/team/${userId}?${qs.toString()}`);
  }

  redirect(`/admin/team/${userId}?notice=${encodeURIComponent("invite_resent")}`);
}

function parseGender(v: FormDataEntryValue | null): Gender | null {
  const s = String(v ?? "").trim();
  if (s === "MALE" || s === "FEMALE" || s === "NON_BINARY" || s === "PREFER_NOT_TO_SAY") return s;
  return null;
}

export async function updateMember(userId: string, fd: FormData) {
  const me = await requireAdmin();

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!existing) redirect("/admin");

  let role: Role;
  let status: EmployeeStatus;

  try {
    const r = parseRole(fd.get("role"));
    if (!r) throw new AdminMutationError("invalid_role_payload");
    role = r;

    const s = parseEmployeeStatus(fd.get("status"));
    if (!s) throw new AdminMutationError("invalid_status_payload");
    status = s;

    assertHrUpdateRole(me.role, existing.role, role);
    await assertNotRemovingLastWorkspaceAdmin(userId, existing.role, role);
  } catch (e) {
    if (e instanceof AdminMutationError) {
      redirect(`/admin/team/${userId}?notice=${encodeURIComponent(e.code)}`);
    }
    throw e;
  }

  const firstName = (fd.get("firstName") as string)?.trim() ?? "";
  const lastName = (fd.get("lastName") as string)?.trim() ?? "";
  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const title = fd.get("title") as string;
  const departmentId = await departmentIdFromForm(prisma, fd);
  const cityId = fd.get("cityId") as string;
  const managerId = fd.get("managerId") as string;
  const joinedAt = fd.get("joinedAt") as string;
  const dateOfLeavingRaw = fd.get("dateOfLeaving") as string | null;
  const probationEndsAtRaw = fd.get("probationEndsAt") as string | null;
  const phone = fd.get("phone") as string;
  const salary = fd.get("salary") as string;
  const salaryNote = fd.get("salaryNote") as string;
  const residentialAddress = fd.get("residentialAddress") as string;
  const emergencyContactName = fd.get("emergencyContactName") as string;
  const emergencyContactPhone = fd.get("emergencyContactPhone") as string;
  const emergencyContactRelation = fd.get("emergencyContactRelation") as string;
  const fatherName = fd.get("fatherName") as string;
  const motherName = fd.get("motherName") as string;
  const personalEmailRaw = (fd.get("personalEmail") as string)?.trim();
  const birthdayRaw = fd.get("birthday") as string | null;
  const pan = (fd.get("pan") as string)?.trim().toUpperCase() || null;
  const aadharRaw = (fd.get("aadhar") as string)?.replace(/\s/g, "") || "";
  const aadhar = aadharRaw.length > 0 ? aadharRaw : null;
  const gender = parseGender(fd.get("gender"));

  await prisma.user.update({
    where: { id: userId },
    data: {
      firstName: firstName || null,
      lastName: lastName || null,
      ...(combinedName ? { name: combinedName } : {}),
      title: title?.trim() || null,
      role,
      status,
      departmentId,
      cityId: cityId || null,
      managerId: managerId || null,
      joinedAt: joinedAt ? new Date(joinedAt) : undefined,
      dateOfLeaving: dateOfLeavingRaw?.trim() ? new Date(dateOfLeavingRaw) : null,
      probationEndsAt: probationEndsAtRaw?.trim()
        ? new Date(probationEndsAtRaw)
        : null,
      phone: phone?.trim() || null,
      residentialAddress: residentialAddress?.trim() || null,
      emergencyContactName: emergencyContactName?.trim() || null,
      emergencyContactPhone: emergencyContactPhone?.trim() || null,
      emergencyContactRelation: emergencyContactRelation?.trim() || null,
      fatherName: fatherName?.trim() || null,
      motherName: motherName?.trim() || null,
      personalEmail: personalEmailRaw || null,
      birthday: birthdayRaw?.trim() ? new Date(birthdayRaw) : null,
      pan: pan || null,
      aadhar,
      gender: gender ?? null,
      updatedAt: new Date(),
    },
  });

  if (isWorkspacePowerUser(me.role) && salary) {
    await prisma.compensation.upsert({
      where: { userId },
      update: {
        monthlySalary: parseInt(salary, 10),
        note: salaryNote?.trim() || null,
        effectiveFrom: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        monthlySalary: parseInt(salary, 10),
        note: salaryNote?.trim() || null,
      },
    });
  }

  redirect("/admin");
}
