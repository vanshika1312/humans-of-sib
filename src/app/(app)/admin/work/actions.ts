"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WORK_ADMIN_ROLES } from "@/lib/work-tracking/access";
import { z } from "zod";

const configSchema = z.object({
  eodDeadlineHour: z.coerce.number().int().min(0).max(23),
  eodDeadlineMinute: z.coerce.number().int().min(0).max(59),
  minEodCompliancePct: z.coerce.number().int().min(0).max(100),
  pipEfficiencyThreshold: z.coerce.number().int().min(0).max(100),
  pipConsecutiveWeeks: z.coerce.number().int().min(1).max(12),
});

export async function updateWorkTrackingConfig(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user || !WORK_ADMIN_ROLES.includes(user.role)) throw new Error("Forbidden");

  const parsed = configSchema.parse({
    eodDeadlineHour: formData.get("eodDeadlineHour"),
    eodDeadlineMinute: formData.get("eodDeadlineMinute"),
    minEodCompliancePct: formData.get("minEodCompliancePct"),
    pipEfficiencyThreshold: formData.get("pipEfficiencyThreshold"),
    pipConsecutiveWeeks: formData.get("pipConsecutiveWeeks"),
  });

  await prisma.workTrackingConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...parsed },
    update: parsed,
  });

  revalidatePath("/admin/work");
  revalidatePath("/work");
  redirect("/admin/work?saved=1");
}
