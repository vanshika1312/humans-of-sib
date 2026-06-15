import { prisma } from "@/lib/prisma";
import { slugifyDepartmentName } from "@/lib/workspace-departments";
import type { TaskComplexity } from "@/generated/prisma";

type DefaultType = { name: string; complexity: TaskComplexity };

/** Default task type libraries per department slug. */
export const DEFAULT_DEPT_TASK_TYPES: Record<string, DefaultType[]> = {
  "video-editing": [
    { name: "Reel", complexity: "MEDIUM" },
    { name: "Ad", complexity: "MEDIUM" },
    { name: "Vlog", complexity: "COMPLEX" },
    { name: "LMS", complexity: "SIMPLE" },
  ],
  sales: [
    { name: "Calls", complexity: "SIMPLE" },
    { name: "Follow-ups", complexity: "SIMPLE" },
    { name: "Demos", complexity: "MEDIUM" },
    { name: "Closures", complexity: "COMPLEX" },
  ],
  marketing: [
    { name: "Posts", complexity: "SIMPLE" },
    { name: "Campaigns", complexity: "COMPLEX" },
    { name: "Reports", complexity: "MEDIUM" },
  ],
  "social-media": [
    { name: "Posts", complexity: "SIMPLE" },
    { name: "Stories", complexity: "SIMPLE" },
    { name: "Engagement", complexity: "MEDIUM" },
    { name: "Analytics", complexity: "MEDIUM" },
  ],
  product: [
    { name: "Feature", complexity: "COMPLEX" },
    { name: "Bug fix", complexity: "MEDIUM" },
    { name: "Research", complexity: "MEDIUM" },
    { name: "Documentation", complexity: "SIMPLE" },
  ],
  operations: [
    { name: "Process", complexity: "MEDIUM" },
    { name: "Coordination", complexity: "SIMPLE" },
    { name: "Audit", complexity: "COMPLEX" },
  ],
  csat: [
    { name: "Ticket", complexity: "SIMPLE" },
    { name: "Callback", complexity: "MEDIUM" },
    { name: "Escalation", complexity: "COMPLEX" },
  ],
  finance: [
    { name: "Reconciliation", complexity: "MEDIUM" },
    { name: "Reporting", complexity: "MEDIUM" },
    { name: "Approval", complexity: "SIMPLE" },
  ],
  accounts: [
    { name: "Invoice", complexity: "SIMPLE" },
    { name: "Payment", complexity: "MEDIUM" },
    { name: "Reconciliation", complexity: "MEDIUM" },
  ],
  hr: [
    { name: "Hiring", complexity: "MEDIUM" },
    { name: "Onboarding", complexity: "MEDIUM" },
    { name: "Policy", complexity: "SIMPLE" },
  ],
  "supply-chain": [
    { name: "Procurement", complexity: "MEDIUM" },
    { name: "Inventory", complexity: "SIMPLE" },
    { name: "Vendor", complexity: "MEDIUM" },
  ],
  tech: [
    { name: "Development", complexity: "COMPLEX" },
    { name: "Code review", complexity: "MEDIUM" },
    { name: "Support", complexity: "SIMPLE" },
  ],
  "founders-office": [
    { name: "Strategy", complexity: "COMPLEX" },
    { name: "Review", complexity: "MEDIUM" },
    { name: "Coordination", complexity: "SIMPLE" },
  ],
};

const FALLBACK_TYPES: DefaultType[] = [
  { name: "General", complexity: "MEDIUM" },
  { name: "Task", complexity: "MEDIUM" },
  { name: "Review", complexity: "SIMPLE" },
  { name: "Project", complexity: "COMPLEX" },
];

/** Ensure a department has at least default task types seeded. */
export async function ensureDeptTaskTypes(departmentId: string, departmentSlug: string) {
  const existing = await prisma.deptTaskType.count({ where: { departmentId } });
  if (existing > 0) {
    const general = await prisma.deptTaskType.findFirst({ where: { departmentId, slug: "general" } });
    if (!general) {
      await prisma.deptTaskType.create({
        data: {
          departmentId,
          name: "General",
          slug: "general",
          complexity: "MEDIUM",
          sortOrder: -1,
        },
      });
    }
    return;
  }

  const defs = DEFAULT_DEPT_TASK_TYPES[departmentSlug] ?? FALLBACK_TYPES;
  const hasGeneral = defs.some((d) => slugifyDepartmentName(d.name) === "general");
  const allDefs = hasGeneral ? defs : [{ name: "General", complexity: "MEDIUM" as TaskComplexity }, ...defs];
  await prisma.deptTaskType.createMany({
    data: allDefs.map((d, i) => ({
      departmentId,
      name: d.name,
      slug: slugifyDepartmentName(d.name),
      complexity: d.complexity,
      sortOrder: i,
    })),
    skipDuplicates: true,
  });
}
