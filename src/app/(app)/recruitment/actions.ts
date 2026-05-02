"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureInterviewPipelineStages } from "@/lib/interview-pipeline";

const RECRUITER_GATE = ["CEO", "ADMIN", "HR"];

async function requireRecruiter() {
  const session = await auth();
  const me = await prisma.user.findUnique({ where: { email: session!.user!.email! } });
  if (!me || !RECRUITER_GATE.includes(me.role)) redirect("/home");
  return me;
}

function canPromoteAdmin(actorRole: Role) {
  return actorRole === "CEO" || actorRole === "ADMIN";
}

async function otherAdminCount(excludingId: string): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", id: { not: excludingId } },
  });
}

export async function grantRecruitmentAccess(formData: FormData) {
  const me = await requireRecruiter();
  const userId = formData.get("userId") as string;
  const roleRaw = formData.get("role") as string;

  if (!userId?.trim()) {
    redirect(`/recruitment/access?error=${encodeURIComponent("Pick someone to grant access.")}`);
  }

  if (roleRaw !== "HR" && roleRaw !== "ADMIN") {
    redirect(`/recruitment/access?error=${encodeURIComponent("Choose Admin or HR.")}`);
  }

  if (roleRaw === "ADMIN" && !canPromoteAdmin(me.role)) {
    redirect(`/recruitment/access?error=${encodeURIComponent("Only CEO or Admin can grant Admin.")}`);
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) redirect(`/recruitment/access?error=${encodeURIComponent("User not found.")}`);
  if (target.role === "CEO") {
    redirect(`/recruitment/access?error=${encodeURIComponent("CEO access is managed separately.")}`);
  }

  if (["ADMIN", "HR"].includes(target.role)) {
    redirect(`/recruitment/access?error=${encodeURIComponent("They already have workspace admin access.")}`);
  }

  const newRole = roleRaw as Role;
  await prisma.user.update({
    where: { id: userId },
    data: {
      role: newRole,
      updatedAt: new Date(),
    },
  });

  redirect("/recruitment/access?saved=1");
}

export async function updateWorkspaceAdminRole(targetUserId: string, formData: FormData) {
  const me = await requireRecruiter();
  const next = formData.get("role") as string;

  if (next !== "HR" && next !== "ADMIN" && next !== "EMPLOYEE") {
    redirect(`/recruitment/access?error=${encodeURIComponent("Invalid role.")}`);
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) redirect(`/recruitment/access?error=${encodeURIComponent("User not found.")}`);

  if (target.role === "CEO") {
    redirect(`/recruitment/access?error=${encodeURIComponent("CEO cannot be edited here.")}`);
  }

  if (!["ADMIN", "HR"].includes(target.role)) {
    redirect(`/recruitment/access?error=${encodeURIComponent("Edit this profile from Manage Team instead.")}`);
  }

  if (me.role === "HR" && target.role === "ADMIN") {
    redirect(`/recruitment/access?error=${encodeURIComponent("Ask CEO or Admin to change this Admin account.")}`);
  }

  const nextRole = next as Role;

  if (me.role === "HR" && nextRole === "ADMIN") {
    redirect(`/recruitment/access?error=${encodeURIComponent("HR cannot assign Admin.")}`);
  }

  if (nextRole === "ADMIN" && target.role !== "ADMIN" && !canPromoteAdmin(me.role)) {
    redirect(`/recruitment/access?error=${encodeURIComponent("Only CEO or Admin can grant Admin.")}`);
  }

  if (target.role === "ADMIN" && nextRole !== "ADMIN") {
    const others = await otherAdminCount(targetUserId);
    if (others < 1) {
      redirect(
        `/recruitment/access?error=${encodeURIComponent("Keep at least one Admin in the workspace.")}`,
      );
    }
  }

  await prisma.user.update({
    where: { id: targetUserId },
    data: {
      role: nextRole,
      updatedAt: new Date(),
    },
  });

  redirect("/recruitment/access?saved=1");
}

export async function updateInterviewPipelineCounts(formData: FormData) {
  await requireRecruiter();
  await ensureInterviewPipelineStages();

  const rows = await prisma.interviewPipelineStage.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    rows.map((row) => {
      const raw = formData.get(`c_${row.id}`);
      let n = typeof raw === "string" ? parseInt(raw, 10) : NaN;
      if (!Number.isFinite(n) || n < 0) n = 0;
      return prisma.interviewPipelineStage.update({
        where: { id: row.id },
        data: { count: n },
      });
    }),
  );

  revalidatePath("/recruitment");
  redirect("/recruitment?pipelineSaved=1");
}
