import { prisma } from "@/lib/prisma";
import { parseHiringJobTemplateFields } from "@/lib/hiring-job-template-fields";
import type { JobProfileTemplateOption } from "@/components/hiring/job-profile-template-picker";

export async function loadJobProfileTemplatesForPicker(): Promise<JobProfileTemplateOption[]> {
  const rows = await prisma.hiringInterviewQuestionTemplate.findMany({
    where: { category: "JOB_POST" },
    orderBy: [{ title: "asc" }],
    select: { id: true, title: true, jobFieldsJson: true },
  });

  return rows
    .map((r) => ({
      id: r.id,
      title: r.title,
      fields: parseHiringJobTemplateFields(r.jobFieldsJson),
    }))
    .filter((r) => r.fields != null);
}
