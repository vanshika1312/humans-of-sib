"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  canPickDepartmentOnRequisition,
  canSubmitJobRequisition,
} from "@/lib/hiring-requisition-access";
import { calendarDateFromInput } from "@/lib/calendar-date";
import { departmentIdFromForm } from "@/lib/department-resolve";

async function requireRequisitionSubmitter() {
  const session = await auth();
  const me = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
    include: {
      headedDept: { select: { id: true } },
      department: { select: { id: true } },
    },
  });
  if (!me || !canSubmitJobRequisition(me.role)) redirect("/home");
  return me;
}

function nu(raw: string) {
  const t = raw.trim();
  return t.length ? t : null;
}

export async function submitJobRequisition(formData: FormData) {
  const me = await requireRequisitionSubmitter();
  const title = String(formData.get("title") || "").trim();
  if (!title) {
    redirect("/requisitions/new?error=" + encodeURIComponent("Title is required."));
  }

  let departmentId: string;
  if (canPickDepartmentOnRequisition(me.role)) {
    const resolved = await departmentIdFromForm(prisma, formData);
    if (!resolved) {
      redirect(
        "/requisitions/new?error=" + encodeURIComponent("Choose or type a department for this request."),
      );
    }
    departmentId = resolved;
  } else if (me.role === "DEPT_HEAD" && me.headedDept) {
    departmentId = me.headedDept.id;
  } else if (me.departmentId) {
    departmentId = me.departmentId;
  } else {
    redirect(
      "/requisitions/new?error=" +
        encodeURIComponent("Your profile has no department. Ask HR to assign you before requesting headcount."),
    );
  }

  const positionsRaw = Number(formData.get("positions"));
  const positions = Number.isFinite(positionsRaw)
    ? Math.min(99, Math.max(1, Math.floor(positionsRaw)))
    : 1;

  let proposedDeadline: Date | null = null;
  const deadlineRaw = String(formData.get("proposedDeadline") || "").trim();
  if (deadlineRaw) {
    const d = calendarDateFromInput(deadlineRaw);
    if (Number.isNaN(d.getTime())) {
      redirect(
        "/requisitions/new?error=" + encodeURIComponent("Proposed deadline must be a valid date."),
      );
    }
    proposedDeadline = d;
  }

  await prisma.hiringRequisition.create({
    data: {
      title,
      description: nu(String(formData.get("description"))),
      employmentType: nu(String(formData.get("employmentType"))),
      location: nu(String(formData.get("location"))),
      justification: nu(String(formData.get("justification"))),
      skillsRequired: nu(String(formData.get("skillsRequired"))),
      proposedDeadline,
      positions,
      departmentId,
      requestedByUserId: me.id,
    },
  });

  revalidatePath("/hiring");
  revalidatePath("/requisitions");
  redirect("/requisitions?submitted=1");
}

export async function cancelOwnJobRequisition(requisitionId: string) {
  const me = await requireRequisitionSubmitter();
  const row = await prisma.hiringRequisition.findUnique({ where: { id: requisitionId } });
  if (!row || row.requestedByUserId !== me.id || row.status !== "PENDING") {
    redirect(
      "/requisitions?error=" + encodeURIComponent("Only your own pending requests can be withdrawn."),
    );
  }
  await prisma.hiringRequisition.update({
    where: { id: requisitionId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/hiring");
  revalidatePath("/requisitions");
  redirect("/requisitions?cancelled=1");
}
