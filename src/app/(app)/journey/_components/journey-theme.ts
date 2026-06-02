import type { MilestoneType } from "../_data/mockEmployeeData";

export const MILESTONE_META: Record<
  MilestoneType,
  { emoji: string; label: string }
> = {
  joining: { emoji: "🌱", label: "Joined" },
  promotion: { emoji: "📈", label: "Promotion" },
  department_transfer: { emoji: "🔄", label: "Transfer" },
  training: { emoji: "🎓", label: "Training" },
  certification: { emoji: "📜", label: "Certification" },
  award: { emoji: "🏆", label: "Award" },
  performance_review: { emoji: "⭐", label: "Review" },
  pip_initiated: { emoji: "⚠️", label: "PIP" },
  pip_closed: { emoji: "✅", label: "PIP Closed" },
  anniversary: { emoji: "📅", label: "Anniversary" },
  recognition: { emoji: "🌟", label: "Recognition" },
};

export function formatTenure(joinedAt: string): string {
  const start = new Date(joinedAt);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} Year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} Month${months === 1 ? "" : "s"}`);
  if (parts.length === 0) parts.push("Less than a month");
  return parts.join(" ");
}

export function groupMilestonesByYear<T extends { date: string }>(
  milestones: T[],
): Record<string, T[]> {
  const sorted = [...milestones].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return sorted.reduce<Record<string, T[]>>((acc, m) => {
    const year = new Date(m.date).getFullYear().toString();
    if (!acc[year]) acc[year] = [];
    acc[year].push(m);
    return acc;
  }, {});
}
