"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

async function requireAdmin() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !ADMIN_ROLES.includes(me.role)) redirect("/home");
  return me;
}

export async function createMember(fd: FormData) {
  await requireAdmin();

  const email = fd.get("email") as string;
  const name = fd.get("name") as string;
  const title = fd.get("title") as string;
  const role = fd.get("role") as string;
  const status = fd.get("status") as string;
  const departmentId = fd.get("departmentId") as string;
  const cityId = fd.get("cityId") as string;
  const joinedAt = fd.get("joinedAt") as string;
  const phone = fd.get("phone") as string;
  const salary = fd.get("salary") as string;

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      title: title?.trim() || null,
      role: role as any,
      status: status as any,
      departmentId: departmentId || null,
      cityId: cityId || null,
      joinedAt: joinedAt ? new Date(joinedAt) : new Date(),
      phone: phone?.trim() || null,
    },
  });

  if (salary && parseInt(salary) > 0) {
    await prisma.compensation.create({
      data: {
        userId: user.id,
        monthlySalary: parseInt(salary),
      },
    });
  }

  redirect("/admin");
}

export async function updateMember(userId: string, fd: FormData) {
  const me = await requireAdmin();

  const name = fd.get("name") as string;
  const title = fd.get("title") as string;
  const role = fd.get("role") as string;
  const status = fd.get("status") as string;
  const departmentId = fd.get("departmentId") as string;
  const cityId = fd.get("cityId") as string;
  const joinedAt = fd.get("joinedAt") as string;
  const phone = fd.get("phone") as string;
  const salary = fd.get("salary") as string;
  const salaryNote = fd.get("salaryNote") as string;

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: name?.trim() || undefined,
      title: title?.trim() || null,
      role: role as any,
      status: status as any,
      departmentId: departmentId || null,
      cityId: cityId || null,
      joinedAt: joinedAt ? new Date(joinedAt) : undefined,
      phone: phone?.trim() || null,
      updatedAt: new Date(),
    },
  });

  // Only CEO/ADMIN can update salary
  if (["CEO", "ADMIN"].includes(me.role) && salary) {
    await prisma.compensation.upsert({
      where: { userId },
      update: {
        monthlySalary: parseInt(salary),
        note: salaryNote?.trim() || null,
        effectiveFrom: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        monthlySalary: parseInt(salary),
        note: salaryNote?.trim() || null,
      },
    });
  }

  redirect("/admin");
}
