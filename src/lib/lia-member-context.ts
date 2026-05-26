import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/user-display-name";
import {
  casualEntitled,
  casualRemaining,
  getHalfYearPeriod,
  isOnProbation,
  sickEntitledPerHalf,
  sickRemaining,
} from "@/lib/leave-policy";

export type LiaMemberContextInput = {
  userId: string;
  refDate?: Date;
};

export async function buildLiaMemberContext(input: LiaMemberContextInput): Promise<string> {
  const refDate = input.refDate ?? new Date();
  const { periodYear, half } = getHalfYearPeriod(refDate);
  const halfLabel = half === 1 ? "Jan–Jun" : "Jul–Dec";

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      firstName: true,
      lastName: true,
      name: true,
      joinedAt: true,
      probationEndsAt: true,
      department: { select: { name: true } },
      city: { select: { name: true } },
      manager: { select: { firstName: true, lastName: true, name: true } },
    },
  });

  if (!user) return "(Member profile not found.)";

  await prisma.leaveBalance.upsert({
    where: {
      userId_periodYear_half: {
        userId: input.userId,
        periodYear,
        half,
      },
    },
    create: { userId: input.userId, periodYear, half },
    update: {},
  });

  const balance = await prisma.leaveBalance.findUnique({
    where: {
      userId_periodYear_half: {
        userId: input.userId,
        periodYear,
        half,
      },
    },
  });

  const casualUsed = balance?.casualUsed ?? 0;
  const sickUsed = balance?.sickUsed ?? 0;
  const onProbation = isOnProbation(user.probationEndsAt, refDate);
  const casualEnt = casualEntitled(user.probationEndsAt, user.joinedAt, refDate);
  const casualRem = casualRemaining({
    probationEndsAt: user.probationEndsAt,
    joinedAt: user.joinedAt,
    refDate,
    casualUsed,
  });
  const sickEnt = sickEntitledPerHalf(user.probationEndsAt, refDate);
  const sickRem = sickRemaining({
    probationEndsAt: user.probationEndsAt,
    refDate,
    sickUsed,
  });

  const lines = [
    `Name: ${displayName(user)}`,
    user.department?.name ? `Department: ${user.department.name}` : null,
    user.city?.name ? `City: ${user.city.name}` : null,
    user.manager ? `Manager: ${displayName(user.manager)}` : null,
    `Leave half-year: ${halfLabel} ${periodYear}`,
    onProbation
      ? `Probation: yes${user.probationEndsAt ? ` (through ${user.probationEndsAt.toISOString().slice(0, 10)})` : ""} — no paid casual/sick yet`
      : "Probation: no (eligible for paid casual/sick per policy)",
    `Casual: ${casualRem} remaining of ${casualEnt} entitled this half (${casualUsed} used)`,
    `Sick: ${sickRem} remaining of ${sickEnt} entitled this half (${sickUsed} used)`,
    "Apply leave: /attendance?tab=requests",
    "Attendance home: /attendance",
  ].filter(Boolean);

  return lines.join("\n");
}
