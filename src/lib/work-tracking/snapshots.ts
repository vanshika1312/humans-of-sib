import { prisma } from "@/lib/prisma";
import {
  calcQuantityEfficiency,
  calcQuantityTotals,
  type QuantityTaskInput,
} from "./efficiency";
import { getWorkTrackingConfig, isPastEodDeadline } from "./config";
import { daysInRange, startOfWeekMonday, startOfMonth, toDateOnly, formatWorkDate } from "./dates";

export type EmployeeDailySnapshot = {
  userId: string;
  name: string;
  departmentName: string | null;
  assignedCount: number;
  completedCount: number;
  assignedQuantity: number;
  deliveredQuantity: number;
  efficiencyPct: number;
  eodStatus: "SUBMITTED" | "DRAFT" | "MISSING" | "NONE";
};

function toQuantityInput(t: {
  targetQuantity: { toString(): string };
  actualQuantity: { toString(): string } | null;
  eodStatus: string | null;
}): QuantityTaskInput {
  return {
    targetQuantity: Number(t.targetQuantity),
    actualQuantity: t.actualQuantity != null ? Number(t.actualQuantity) : null,
    eodStatus: t.eodStatus as QuantityTaskInput["eodStatus"],
  };
}

export async function loadTeamDailySnapshot(args: {
  memberIds: string[];
  workDate: Date;
}): Promise<EmployeeDailySnapshot[]> {
  if (args.memberIds.length === 0) return [];

  const [tasks, submissions, users, config] = await Promise.all([
    prisma.dailyWorkTask.findMany({
      where: { assigneeId: { in: args.memberIds }, workDate: args.workDate },
    }),
    prisma.dailyEodSubmission.findMany({
      where: { userId: { in: args.memberIds }, workDate: args.workDate },
    }),
    prisma.user.findMany({
      where: { id: { in: args.memberIds } },
      select: { id: true, name: true, firstName: true, lastName: true, department: { select: { name: true } } },
    }),
    getWorkTrackingConfig(),
  ]);

  const tasksByUser = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const list = tasksByUser.get(t.assigneeId) ?? [];
    list.push(t);
    tasksByUser.set(t.assigneeId, list);
  }

  const subByUser = new Map(submissions.map((s) => [s.userId, s]));
  const pastDeadline = isPastEodDeadline(args.workDate, config);

  return users.map((u) => {
    const userTasks = tasksByUser.get(u.id) ?? [];
    const sub = subByUser.get(u.id);
    const inputs = userTasks.map(toQuantityInput);
    const primaryPct = calcQuantityEfficiency(inputs);
    const { assigned, delivered } = calcQuantityTotals(inputs);
    const completedCount = userTasks.filter((t) => t.eodStatus === "COMPLETED").length;

    let eodStatus: EmployeeDailySnapshot["eodStatus"] = "NONE";
    if (userTasks.length > 0) {
      const hasUnreported = userTasks.some((t) => t.eodStatus === null);
      if (sub?.status === "SUBMITTED" && !hasUnreported) eodStatus = "SUBMITTED";
      else if (sub?.status === "SUBMITTED" && hasUnreported) eodStatus = "DRAFT";
      else if (sub?.status === "DRAFT") eodStatus = "DRAFT";
      else if (pastDeadline) eodStatus = "MISSING";
      else eodStatus = "DRAFT";
    }

    const displayName = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || "Unknown";

    return {
      userId: u.id,
      name: displayName,
      departmentName: u.department?.name ?? null,
      assignedCount: userTasks.length,
      completedCount,
      assignedQuantity: assigned,
      deliveredQuantity: delivered,
      efficiencyPct: sub?.efficiencyPct ?? primaryPct,
      eodStatus,
    };
  });
}

export type EfficiencyTrendPoint = {
  date: string;
  efficiencyPct: number;
  eodSubmitted: boolean;
  assignedQuantity: number;
  deliveredQuantity: number;
};

export async function loadEfficiencyTrend(userId: string, days = 14): Promise<EfficiencyTrendPoint[]> {
  const end = toDateOnly(new Date());
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const range = daysInRange(start, end);
  const [tasks, submissions] = await Promise.all([
    prisma.dailyWorkTask.findMany({
      where: { assigneeId: userId, workDate: { gte: start, lte: end } },
    }),
    prisma.dailyEodSubmission.findMany({
      where: { userId, workDate: { gte: start, lte: end }, status: "SUBMITTED" },
    }),
  ]);

  const tasksByDate = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const key = t.workDate.toISOString().slice(0, 10);
    const list = tasksByDate.get(key) ?? [];
    list.push(t);
    tasksByDate.set(key, list);
  }
  const subDates = new Set(submissions.map((s) => s.workDate.toISOString().slice(0, 10)));

  return range.map((d) => {
    const key = d.toISOString().slice(0, 10);
    const dayTasks = tasksByDate.get(key) ?? [];
    const inputs = dayTasks.map(toQuantityInput);
    const { assigned, delivered } = calcQuantityTotals(inputs);
    return {
      date: key,
      efficiencyPct: calcQuantityEfficiency(inputs),
      eodSubmitted: subDates.has(key),
      assignedQuantity: assigned,
      deliveredQuantity: delivered,
    };
  });
}

export type DeptEfficiencyRow = {
  departmentId: string;
  departmentName: string;
  emoji: string | null;
  avgEfficiency: number;
  eodCompliancePct: number;
  flaggedCount: number;
  memberCount: number;
};

export async function loadCrossDeptEfficiency(monthDate = new Date()): Promise<DeptEfficiencyRow[]> {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = toDateOnly(monthDate);
  const config = await getWorkTrackingConfig();

  const [departments, activeUsers, tasks, submissions] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { status: "ACTIVE", departmentId: { not: null } },
      select: { id: true, departmentId: true },
    }),
    prisma.dailyWorkTask.findMany({
      where: { workDate: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.dailyEodSubmission.findMany({
      where: { workDate: { gte: monthStart, lte: monthEnd }, status: "SUBMITTED" },
    }),
  ]);

  const usersByDept = new Map<string, string[]>();
  for (const u of activeUsers) {
    if (!u.departmentId) continue;
    const list = usersByDept.get(u.departmentId) ?? [];
    list.push(u.id);
    usersByDept.set(u.departmentId, list);
  }

  const workDays = daysInRange(monthStart, monthEnd).filter((d) => {
    const day = d.getUTCDay();
    return day !== 0 && day !== 6;
  }).length;

  return departments.map((dept) => {
    const memberIds = usersByDept.get(dept.id) ?? [];
    const deptTasks = tasks.filter((t) => t.departmentId === dept.id);
    const deptSubs = submissions.filter((s) => memberIds.includes(s.userId));

    const inputs = deptTasks.map(toQuantityInput);
    const primaryPct = calcQuantityEfficiency(inputs);

    const expectedSubmissions = memberIds.length * Math.max(workDays, 1);
    const eodCompliancePct =
      expectedSubmissions > 0 ? Math.round((deptSubs.length / expectedSubmissions) * 100) : 100;

    const flaggedCount = memberIds.length > 0 ? countFlaggedMembers(memberIds, deptTasks, config.pipEfficiencyThreshold) : 0;

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      emoji: dept.emoji,
      avgEfficiency: primaryPct,
      eodCompliancePct,
      flaggedCount,
      memberCount: memberIds.length,
    };
  });
}

function countFlaggedMembers(
  memberIds: string[],
  tasks: {
    assigneeId: string;
    targetQuantity: { toString(): string };
    actualQuantity: { toString(): string } | null;
    eodStatus: string | null;
  }[],
  threshold: number,
): number {
  let flagged = 0;
  for (const uid of memberIds) {
    const userTasks = tasks.filter((t) => t.assigneeId === uid);
    if (userTasks.length === 0) continue;
    const pct = calcQuantityEfficiency(userTasks.map(toQuantityInput));
    if (pct < threshold) flagged++;
  }
  return flagged;
}

export async function loadWeeklyRollup(userId: string, refDate = new Date()) {
  const weekStart = startOfWeekMonday(refDate);
  const weekEnd = toDateOnly(refDate);
  const tasks = await prisma.dailyWorkTask.findMany({
    where: { assigneeId: userId, workDate: { gte: weekStart, lte: weekEnd } },
  });
  return calcQuantityEfficiency(tasks.map(toQuantityInput));
}

export type CarryForwardSuggestion = {
  sourceTaskId: string;
  taskName: string;
  quantityUnit: string;
  remainingQuantity: number;
  originalTarget: number;
  actualQuantity: number;
  sourceDate: string;
  keyResultId: string | null;
  taskTypeId: string;
};

/** Incomplete tasks from the previous work day eligible for carry-forward. */
export async function loadCarryForwardSuggestions(args: {
  assigneeId: string;
  workDate: Date;
}): Promise<CarryForwardSuggestion[]> {
  const prev = new Date(args.workDate);
  prev.setUTCDate(prev.getUTCDate() - 1);

  const existingCarried = await prisma.dailyWorkTask.findMany({
    where: { assigneeId: args.assigneeId, workDate: args.workDate, carriedFromTaskId: { not: null } },
    select: { carriedFromTaskId: true },
  });
  const alreadyCarried = new Set(existingCarried.map((t) => t.carriedFromTaskId).filter(Boolean));

  const prevTasks = await prisma.dailyWorkTask.findMany({
    where: {
      assigneeId: args.assigneeId,
      workDate: prev,
      OR: [
        { carryForward: true },
        {
          eodStatus: { in: ["PARTIAL", "NOT_STARTED"] },
        },
      ],
    },
  });

  const suggestions: CarryForwardSuggestion[] = [];
  for (const t of prevTasks) {
    if (alreadyCarried.has(t.id)) continue;
    const target = Number(t.targetQuantity);
    const actual = t.eodStatus === "NOT_STARTED" || t.eodStatus === null ? 0 : Number(t.actualQuantity ?? 0);
    if (t.eodStatus === "COMPLETED" && actual >= target) continue;
    const remaining = Math.max(0.01, target - actual);
    suggestions.push({
      sourceTaskId: t.id,
      taskName: t.projectName,
      quantityUnit: t.quantityUnit,
      remainingQuantity: remaining,
      originalTarget: target,
      actualQuantity: actual,
      sourceDate: formatWorkDate(t.workDate),
      keyResultId: t.keyResultId,
      taskTypeId: t.taskTypeId,
    });
  }
  return suggestions;
}

export type TeamTaskBoardRow = {
  id: string;
  userId: string;
  departmentId: string;
  memberName: string;
  taskName: string;
  targetQuantity: number;
  actualQuantity: number | null;
  quantityUnit: string;
  eodStatus: string | null;
  keyResultTitle: string | null;
  keyResultId: string | null;
  taskTypeId: string;
  priority: string;
  dueByTime: string | null;
  canManage: boolean;
};

export async function loadTeamTaskBoard(args: {
  memberIds: string[];
  workDate: Date;
}): Promise<TeamTaskBoardRow[]> {
  if (args.memberIds.length === 0) return [];

  const [tasks, users] = await Promise.all([
    prisma.dailyWorkTask.findMany({
      where: { assigneeId: { in: args.memberIds }, workDate: args.workDate },
      include: {
        keyResult: { select: { title: true } },
        assignee: { select: { id: true, firstName: true, lastName: true, name: true } },
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.user.findMany({
      where: { id: { in: args.memberIds } },
      select: { id: true, firstName: true, lastName: true, name: true },
    }),
  ]);

  const nameById = new Map(
    users.map((u) => [
      u.id,
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || "Unknown",
    ]),
  );

  return tasks.map((t) => ({
    id: t.id,
    userId: t.assigneeId,
    departmentId: t.departmentId,
    memberName: nameById.get(t.assigneeId) ?? "Unknown",
    taskName: t.projectName,
    targetQuantity: Number(t.targetQuantity),
    actualQuantity: t.actualQuantity != null ? Number(t.actualQuantity) : null,
    quantityUnit: t.quantityUnit,
    eodStatus: t.eodStatus,
    keyResultTitle: t.keyResult?.title ?? null,
    keyResultId: t.keyResultId,
    taskTypeId: t.taskTypeId,
    priority: t.priority,
    dueByTime: t.dueByTime,
    canManage: false,
  }));
}

export type TeamDailyMetrics = {
  totalTasks: number;
  quantityCompletionPct: number;
  assignedQuantity: number;
  deliveredQuantity: number;
  eodSubmitted: number;
  eodExpected: number;
};

export async function loadTeamDailyMetrics(args: {
  memberIds: string[];
  workDate: Date;
}): Promise<TeamDailyMetrics> {
  const [tasks, submissions] = await Promise.all([
    prisma.dailyWorkTask.findMany({
      where: { assigneeId: { in: args.memberIds }, workDate: args.workDate },
    }),
    prisma.dailyEodSubmission.findMany({
      where: { userId: { in: args.memberIds }, workDate: args.workDate, status: "SUBMITTED" },
    }),
  ]);

  const inputs = tasks.map(toQuantityInput);
  const { assigned, delivered } = calcQuantityTotals(inputs);
  const membersWithTasks = new Set(tasks.map((t) => t.assigneeId));

  return {
    totalTasks: tasks.length,
    quantityCompletionPct: calcQuantityEfficiency(inputs),
    assignedQuantity: assigned,
    deliveredQuantity: delivered,
    eodSubmitted: submissions.length,
    eodExpected: membersWithTasks.size,
  };
}
