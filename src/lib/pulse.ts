import { prisma } from "@/lib/prisma";
import { weekStartDate } from "@/lib/utils";

export const PULSE_ADMIN_ROLES = ["CEO", "ADMIN", "HR"] as const;

export const DEFAULT_PULSE_QUESTION = "How are you feeling about work this week?";
export const DEFAULT_PULSE_PROMPT_LABEL = "Ritvik · CPO";

export type PulseWeekConfig = {
  question: string;
  promptLabel: string;
  weekStart: Date;
  fromDatabase: boolean;
};

export function calendarDateToParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseWeekStartParam(value: string | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    if (!Number.isNaN(parsed.getTime())) return weekStartDate(parsed);
  }
  return weekStartDate();
}

export function addWeeks(weekStart: Date, deltaWeeks: number): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return weekStartDate(d);
}

export async function getPulseWeekConfig(weekStart: Date = weekStartDate()): Promise<PulseWeekConfig> {
  const row = await prisma.pulseWeek.findUnique({ where: { weekStart } });
  if (row) {
    return {
      question: row.question,
      promptLabel: row.promptLabel ?? DEFAULT_PULSE_PROMPT_LABEL,
      weekStart,
      fromDatabase: true,
    };
  }
  return {
    question: DEFAULT_PULSE_QUESTION,
    promptLabel: DEFAULT_PULSE_PROMPT_LABEL,
    weekStart,
    fromDatabase: false,
  };
}

export type PulseScoreBucket = { score: number; count: number };

export type PulseDepartmentRow = {
  departmentId: string | null;
  departmentName: string;
  activeCount: number;
  responseCount: number;
  avgScore: number | null;
};

export type PulseAdminSnapshot = {
  weekStart: Date;
  activeCount: number;
  responseCount: number;
  participationPct: number | null;
  avgScore: number | null;
  distribution: PulseScoreBucket[];
  byDepartment: PulseDepartmentRow[];
  weeklyTrend: { weekStart: Date; avgScore: number; responseCount: number }[];
};

export async function loadPulseAdminSnapshot(weekStart: Date): Promise<PulseAdminSnapshot> {
  const trendWeekStarts = Array.from({ length: 8 }, (_, i) => addWeeks(weekStart, -7 + i));

  const [activeUsers, responses, trendResponses] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, departmentId: true, department: { select: { name: true } } },
    }),
    prisma.pulseResponse.findMany({
      where: { weekStart },
      select: { score: true, userId: true },
    }),
    prisma.pulseResponse.findMany({
      where: { weekStart: { in: trendWeekStarts } },
      select: { weekStart: true, score: true },
    }),
  ]);

  const activeCount = activeUsers.length;
  const responseCount = responses.length;
  const participationPct =
    activeCount > 0 ? Math.round((responseCount / activeCount) * 100) : null;
  const avgScore =
    responseCount > 0
      ? Number((responses.reduce((s, r) => s + r.score, 0) / responseCount).toFixed(1))
      : null;

  const distribution: PulseScoreBucket[] = [1, 2, 3, 4, 5].map((score) => ({
    score,
    count: responses.filter((r) => r.score === score).length,
  }));

  const responseByUser = new Map(responses.map((r) => [r.userId, r]));
  const deptMap = new Map<string | null, PulseDepartmentRow>();

  for (const u of activeUsers) {
    const key = u.departmentId;
    if (!deptMap.has(key)) {
      deptMap.set(key, {
        departmentId: key,
        departmentName: u.department?.name ?? "No department",
        activeCount: 0,
        responseCount: 0,
        avgScore: null,
      });
    }
    const row = deptMap.get(key)!;
    row.activeCount += 1;
    const resp = responseByUser.get(u.id);
    if (resp) row.responseCount += 1;
  }

  for (const row of deptMap.values()) {
    if (row.responseCount === 0) continue;
    const scores = activeUsers
      .filter((u) => u.departmentId === row.departmentId)
      .map((u) => responseByUser.get(u.id)?.score)
      .filter((s): s is number => s != null);
    row.avgScore =
      scores.length > 0
        ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1))
        : null;
  }

  const byDepartment = [...deptMap.values()].sort(
    (a, b) => b.responseCount - a.responseCount || a.departmentName.localeCompare(b.departmentName),
  );

  const weeklyTrend = trendWeekStarts.map((ws) => {
    const wsKey = calendarDateToParam(ws);
    const weekRows = trendResponses.filter((r) => calendarDateToParam(r.weekStart) === wsKey);
    return {
      weekStart: ws,
      responseCount: weekRows.length,
      avgScore:
        weekRows.length > 0
          ? Number((weekRows.reduce((s, r) => s + r.score, 0) / weekRows.length).toFixed(1))
          : 0,
    };
  });

  return {
    weekStart,
    activeCount,
    responseCount,
    participationPct,
    avgScore,
    distribution,
    byDepartment,
    weeklyTrend,
  };
}
