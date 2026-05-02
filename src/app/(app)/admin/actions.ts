"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { EmployeeStatus, Role } from "@/generated/prisma";
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

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

async function requireAdmin() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/home");
  return me;
}

export async function createMember(fd: FormData) {
  const me = await requireAdmin();

  const email = fd.get("email") as string;
  const name = fd.get("name") as string;
  const title = fd.get("title") as string;
  const joinedAt = fd.get("joinedAt") as string;
  const phone = fd.get("phone") as string;
  const salary = fd.get("salary") as string;
  const departmentId = fd.get("departmentId") as string;
  const cityId = fd.get("cityId") as string;

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

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      title: title?.trim() || null,
      role,
      status,
      departmentId: departmentId || null,
      cityId: cityId || null,
      joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
      phone: phone?.trim() || null,
    },
  });

  let notice: string | undefined;
  const salaryN = salary?.trim() ? parseInt(salary, 10) : NaN;
  if (Number.isFinite(salaryN) && salaryN > 0) {
    if (isWorkspacePowerUser(me.role)) {
      await prisma.compensation.create({
        data: {
          userId: user.id,
          monthlySalary: salaryN,
        },
      });
    } else {
      notice = "salary_create_blocked";
    }
  }

  redirect(notice ? `/admin?notice=${encodeURIComponent(notice)}` : "/admin");
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

  const name = fd.get("name") as string;
  const title = fd.get("title") as string;
  const departmentId = fd.get("departmentId") as string;
  const cityId = fd.get("cityId") as string;
  const joinedAt = fd.get("joinedAt") as string;
  const probationEndsAtRaw = fd.get("probationEndsAt") as string | null;
  const phone = fd.get("phone") as string;
  const salary = fd.get("salary") as string;
  const salaryNote = fd.get("salaryNote") as string;

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: name?.trim() || undefined,
      title: title?.trim() || null,
      role,
      status,
      departmentId: departmentId || null,
      cityId: cityId || null,
      joinedAt: joinedAt ? new Date(joinedAt) : undefined,
      probationEndsAt: probationEndsAtRaw?.trim()
        ? new Date(probationEndsAtRaw)
        : null,
      phone: phone?.trim() || null,
      updatedAt: new Date(),
    },
  });

  // CEO & Workspace Admin: compensation. HR can't persist salary even if the form payload is tweaked.
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
