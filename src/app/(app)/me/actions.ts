"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  employeeSelfProfileToDb,
  parseEmployeeSelfProfileForm,
} from "@/lib/employee-self-profile";
import {
  AdminMutationError,
  ADMIN_MUTATION_MESSAGES,
  assertEmployeeCodeAvailable,
  normalizeEmployeeCode,
} from "@/lib/admin-mutations";

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const parsed = parseEmployeeSelfProfileForm(formData);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Please check the form and try again.";
    redirect(`/me?error=${encodeURIComponent(msg)}`);
  }

  const bio = String(formData.get("bio") || "").slice(0, 500) || null;
  const title = String(formData.get("title") || "").slice(0, 100) || null;

  const normalizedEmployeeCode = normalizeEmployeeCode(formData.get("employeeCode"));
  if (!normalizedEmployeeCode) {
    redirect(`/me?error=${encodeURIComponent(ADMIN_MUTATION_MESSAGES.employee_code_required)}`);
  }
  if (normalizedEmployeeCode !== user.employeeCode) {
    try {
      await assertEmployeeCodeAvailable(normalizedEmployeeCode, user.id);
    } catch (e) {
      if (e instanceof AdminMutationError) {
        redirect(`/me?error=${encodeURIComponent(ADMIN_MUTATION_MESSAGES[e.code] ?? e.code)}`);
      }
      throw e;
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...employeeSelfProfileToDb(parsed.data),
      bio,
      title,
      employeeCode: normalizedEmployeeCode,
    },
  });

  revalidatePath("/me");
  revalidatePath("/home");
  revalidatePath(`/people/${user.id}`);
  redirect("/me?saved=1");
}
