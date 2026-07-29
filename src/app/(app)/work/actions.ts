"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createNotification } from "@/lib/notifications";
import { canAssignDailyTasks, canManageDeptOkrs, canEditDailyWorkTaskDetails, canViewDailyWorkTask } from "@/lib/work-tracking/access";
import { ensureDeptTaskTypes } from "@/lib/work-tracking/default-task-types";
import { calcQuantityEfficiency, suggestEodStatus } from "@/lib/work-tracking/efficiency";
import { QUANTITY_UNIT_PRESETS } from "@/lib/work-tracking/config";
import { refreshKeyResultProgress } from "@/lib/work-tracking/okr-progress";
import { todayDateOnly, parseWorkDateParam, formatWorkDate } from "@/lib/work-tracking/dates";
import { slugifyDepartmentName } from "@/lib/workspace-departments";
import { persistTaskAttachmentFile } from "@/lib/task-attachment-upload";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { department: true, headedDept: { select: { id: true } } },
  });
  if (!user) throw new Error("User not found");
  return user;
}

const assignTaskSchema = z.object({
  assigneeId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taskTypeId: z.string().optional().nullable(),
  projectName: z.string().min(1).max(200),
  targetQuantity: z.coerce.number().positive().max(99999),
  quantityUnit: z.string().min(1).max(40),
  priority: z.enum(["P1", "P2", "P3"]),
  dueByTime: z.string().optional().nullable(),
  keyResultId: z.string().optional().nullable(),
});

function parseQuantityUnit(formData: FormData): string {
  const preset = String(formData.get("quantityUnitPreset") || "").trim();
  const custom = String(formData.get("quantityUnitCustom") || "").trim();
  if (preset === "__custom__") return custom || "units";
  if (preset) return preset;
  return String(formData.get("quantityUnit") || "units").trim() || "units";
}

async function resolveTaskTypeId(departmentId: string, departmentSlug: string, taskTypeId: string | null | undefined) {
  if (taskTypeId) return taskTypeId;
  await ensureDeptTaskTypes(departmentId, departmentSlug);
  const general = await prisma.deptTaskType.findFirst({
    where: { departmentId, slug: "general" },
  });
  if (general) return general.id;
  const any = await prisma.deptTaskType.findFirst({
    where: { departmentId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (!any) throw new Error("No task types for department");
  return any.id;
}

export async function assignDailyTask(formData: FormData) {
  const user = await requireUser();
  const quantityUnit = parseQuantityUnit(formData);
  if (!QUANTITY_UNIT_PRESETS.includes(quantityUnit as (typeof QUANTITY_UNIT_PRESETS)[number]) && quantityUnit.length > 40) {
    throw new Error("Invalid unit");
  }

  const parsed = assignTaskSchema.parse({
    assigneeId: formData.get("assigneeId"),
    workDate: formData.get("workDate"),
    taskTypeId: formData.get("taskTypeId") || null,
    projectName: formData.get("projectName"),
    targetQuantity: formData.get("targetQuantity"),
    quantityUnit,
    priority: formData.get("priority"),
    dueByTime: formData.get("dueByTime") || null,
    keyResultId: formData.get("keyResultId") || null,
  });

  const assignee = await prisma.user.findUnique({
    where: { id: parsed.assigneeId },
    select: {
      id: true,
      departmentId: true,
      managerId: true,
      firstName: true,
      lastName: true,
      name: true,
      department: { select: { slug: true } },
    },
  });
  if (!assignee?.departmentId) throw new Error("Assignee has no department");

  const taskTypeId = await resolveTaskTypeId(
    assignee.departmentId,
    assignee.department?.slug ?? "general",
    parsed.taskTypeId,
  );

  if (
    !canAssignDailyTasks({
      viewerRole: user.role,
      viewerPermissions: user.permissions,
      viewerUserId: user.id,
      viewerHeadedDepartmentId: user.headedDept?.id ?? null,
      assigneeManagerId: assignee.managerId,
      assigneeDepartmentId: assignee.departmentId,
    })
  ) {
    throw new Error("Forbidden");
  }

  const workDate = parseWorkDateParam(parsed.workDate);

  const task = await prisma.dailyWorkTask.create({
    data: {
      workDate,
      assigneeId: parsed.assigneeId,
      assignedById: user.id,
      departmentId: assignee.departmentId,
      taskTypeId,
      projectName: parsed.projectName,
      targetQuantity: parsed.targetQuantity,
      quantityUnit: parsed.quantityUnit,
      priority: parsed.priority,
      dueByTime: parsed.dueByTime || null,
      keyResultId: parsed.keyResultId || null,
    },
    include: { taskType: { select: { name: true } } },
  });

  const assigneeName = [assignee.firstName, assignee.lastName].filter(Boolean).join(" ") || assignee.name || "You";
  if (parsed.assigneeId !== user.id) {
    await createNotification({
      userId: parsed.assigneeId,
      kind: "DAILY_TASK_ASSIGNED",
      title: `New task: ${task.taskType.name}`,
      body: `${parsed.projectName} — due ${parsed.dueByTime ?? "EOD"}`,
      href: `/work?date=${parsed.workDate}`,
      actorUserId: user.id,
    });
  }

  revalidatePath("/work");
  revalidatePath("/work/team");
}

export async function submitEod(formData: FormData) {
  const user = await requireUser();
  const workDateStr = String(formData.get("workDate") || "");
  const workDate = parseWorkDateParam(workDateStr);

  const tasks = await prisma.dailyWorkTask.findMany({
    where: { assigneeId: user.id, workDate },
    include: { taskType: { select: { complexity: true } } },
  });
  if (tasks.length === 0) throw new Error("No tasks assigned for this day");

  const entries = tasks.map((task) => {
    const target = Number(task.targetQuantity);
    const actualQty = Number(formData.get(`actual-${task.id}`) || 0);
    const statusRaw = String(formData.get(`status-${task.id}`) || "");
    const status = (
      statusRaw === "COMPLETED" || statusRaw === "PARTIAL" || statusRaw === "NOT_STARTED"
        ? statusRaw
        : suggestEodStatus(target, actualQty)
    ) as "COMPLETED" | "PARTIAL" | "NOT_STARTED";
    const blocker = String(formData.get(`blocker-${task.id}`) || "").trim() || null;
    const carryForward = formData.get(`carry-${task.id}`) === "on" || status !== "COMPLETED";
    return { task, status, actualQty, blocker, carryForward };
  });

  const efficiencyInputs = entries.map((e) => ({
    targetQuantity: Number(e.task.targetQuantity),
    actualQuantity: e.actualQty,
    eodStatus: e.status,
  }));
  const primaryPct = calcQuantityEfficiency(efficiencyInputs);

  const submission = await prisma.dailyEodSubmission.upsert({
    where: { userId_workDate: { userId: user.id, workDate } },
    create: {
      userId: user.id,
      workDate,
      status: "SUBMITTED",
      submittedAt: new Date(),
      efficiencyPct: primaryPct,
      weightedScore: primaryPct,
    },
    update: {
      status: "SUBMITTED",
      submittedAt: new Date(),
      efficiencyPct: primaryPct,
      weightedScore: primaryPct,
    },
  });

  await prisma.dailyEodTaskEntry.deleteMany({ where: { submissionId: submission.id } });

  const keyResultIds = new Set<string>();
  const taskTypeIds = new Set<string>();

  for (const e of entries) {
    await prisma.dailyEodTaskEntry.create({
      data: {
        submissionId: submission.id,
        taskId: e.task.id,
        status: e.status,
        actualQuantity: e.actualQty,
        blockerReason: e.blocker,
        carryForward: e.carryForward,
      },
    });
    await prisma.dailyWorkTask.update({
      where: { id: e.task.id },
      data: {
        eodStatus: e.status,
        actualQuantity: e.actualQty,
        blockerReason: e.blocker,
        carryForward: e.carryForward,
      },
    });
    if (e.task.keyResultId) keyResultIds.add(e.task.keyResultId);
    taskTypeIds.add(e.task.taskTypeId);
  }

  for (const krId of keyResultIds) {
    await refreshKeyResultProgress(krId);
  }

  if (taskTypeIds.size > 0 && user.departmentId) {
    const autoKrs = await prisma.deptOkrKeyResult.findMany({
      where: {
        taskTypeId: { in: [...taskTypeIds] },
        objective: { departmentId: user.departmentId, status: { not: "ARCHIVED" } },
      },
      select: { id: true },
    });
    for (const kr of autoKrs) {
      if (!keyResultIds.has(kr.id)) await refreshKeyResultProgress(kr.id);
    }
  }

  revalidatePath("/work");
  revalidatePath("/work/okrs");
  revalidatePath("/work/team");
  revalidatePath("/admin/work");
  redirect(`/work?date=${formatWorkDate(workDate)}&tab=eod`);
}

const deptOkrSchema = z.object({
  departmentId: z.string().min(1),
  cycle: z.enum(["QUARTER", "MONTH"]),
  year: z.coerce.number().int(),
  quarter: z.coerce.number().int().min(1).max(4).optional().nullable(),
  month: z.coerce.number().int().min(1).max(12).optional().nullable(),
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
});

export async function createDeptOkrObjective(formData: FormData) {
  const user = await requireUser();
  const parsed = deptOkrSchema.parse({
    departmentId: formData.get("departmentId"),
    cycle: formData.get("cycle"),
    year: formData.get("year"),
    quarter: formData.get("quarter") || null,
    month: formData.get("month") || null,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });

  if (
    !canManageDeptOkrs({
      viewerRole: user.role,
      viewerHeadedDepartmentId: user.headedDept?.id ?? null,
      departmentId: parsed.departmentId,
    })
  ) {
    throw new Error("Forbidden");
  }

  const objective = await prisma.deptOkrObjective.create({
    data: {
      departmentId: parsed.departmentId,
      createdById: user.id,
      cycle: parsed.cycle,
      year: parsed.year,
      quarter: parsed.cycle === "QUARTER" ? parsed.quarter : null,
      month: parsed.cycle === "MONTH" ? parsed.month : null,
      title: parsed.title,
      description: parsed.description,
    },
  });

  revalidatePath("/work/okrs");
}

const krSchema = z.object({
  objectiveId: z.string().min(1),
  title: z.string().min(3).max(200),
  taskTypeId: z.string().optional().nullable(),
  targetValue: z.coerce.number().positive(),
  unit: z.enum(["COUNT", "PERCENT", "CURRENCY"]),
  unitLabel: z.string().max(40).optional().nullable(),
  weight: z.coerce.number().int().min(1).max(10).default(1),
});

export async function createDeptKeyResult(formData: FormData) {
  const user = await requireUser();
  const parsed = krSchema.parse({
    objectiveId: formData.get("objectiveId"),
    title: formData.get("title"),
    taskTypeId: formData.get("taskTypeId") || null,
    targetValue: formData.get("targetValue"),
    unit: formData.get("unit"),
    unitLabel: formData.get("unitLabel") || null,
    weight: formData.get("weight") || 1,
  });

  const objective = await prisma.deptOkrObjective.findUnique({ where: { id: parsed.objectiveId } });
  if (!objective) throw new Error("Objective not found");

  if (
    !canManageDeptOkrs({
      viewerRole: user.role,
      viewerHeadedDepartmentId: user.headedDept?.id ?? null,
      departmentId: objective.departmentId,
    })
  ) {
    throw new Error("Forbidden");
  }

  await prisma.deptOkrKeyResult.create({
    data: {
      objectiveId: parsed.objectiveId,
      title: parsed.title,
      taskTypeId: parsed.taskTypeId || null,
      targetValue: parsed.targetValue,
      unit: parsed.unit,
      unitLabel: parsed.unitLabel || null,
      weight: parsed.weight,
    },
  });

  revalidatePath("/work/okrs");
  revalidatePath("/work/team");
}

const carryForwardSchema = z.object({
  sourceTaskId: z.string().min(1),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function carryForwardDailyTask(formData: FormData) {
  const user = await requireUser();
  const parsed = carryForwardSchema.parse({
    sourceTaskId: formData.get("sourceTaskId"),
    workDate: formData.get("workDate"),
  });

  const source = await prisma.dailyWorkTask.findUnique({
    where: { id: parsed.sourceTaskId },
    include: {
      assignee: {
        select: {
          id: true,
          departmentId: true,
          managerId: true,
          firstName: true,
          lastName: true,
          name: true,
        },
      },
    },
  });
  if (!source?.assignee.departmentId) throw new Error("Source task not found");

  if (
    !canAssignDailyTasks({
      viewerRole: user.role,
      viewerPermissions: user.permissions,
      viewerUserId: user.id,
      viewerHeadedDepartmentId: user.headedDept?.id ?? null,
      assigneeManagerId: source.assignee.managerId,
      assigneeDepartmentId: source.assignee.departmentId,
    })
  ) {
    throw new Error("Forbidden");
  }

  const workDate = parseWorkDateParam(parsed.workDate);
  const target = Number(source.targetQuantity);
  const actual =
    source.eodStatus === "NOT_STARTED" || source.eodStatus === null
      ? 0
      : Number(source.actualQuantity ?? 0);
  const remaining = Math.max(0.01, target - actual);

  const existing = await prisma.dailyWorkTask.findFirst({
    where: { carriedFromTaskId: source.id, workDate },
  });
  if (existing) throw new Error("Already carried forward for this day");

  const task = await prisma.dailyWorkTask.create({
    data: {
      workDate,
      assigneeId: source.assigneeId,
      assignedById: user.id,
      departmentId: source.departmentId,
      taskTypeId: source.taskTypeId,
      projectName: source.projectName,
      targetQuantity: remaining,
      quantityUnit: source.quantityUnit,
      priority: source.priority,
      keyResultId: source.keyResultId,
      carriedFromTaskId: source.id,
    },
    include: { taskType: { select: { name: true } } },
  });

  if (source.assigneeId !== user.id) {
    await createNotification({
      userId: source.assigneeId,
      kind: "DAILY_TASK_ASSIGNED",
      title: `Carry-forward: ${task.taskType.name}`,
      body: `${source.projectName} — ${remaining} ${source.quantityUnit} remaining`,
      href: `/work?date=${parsed.workDate}`,
      actorUserId: user.id,
    });
  }

  revalidatePath("/work");
  revalidatePath("/work/team");
}

const taskTypeSchema = z.object({
  departmentId: z.string().min(1),
  name: z.string().min(2).max(80),
  complexity: z.enum(["SIMPLE", "MEDIUM", "COMPLEX"]),
});

const updateTaskSchema = z.object({
  taskId: z.string().min(1),
  projectName: z.string().min(1).max(200),
  targetQuantity: z.coerce.number().positive().max(99999),
  quantityUnit: z.string().min(1).max(40),
  priority: z.enum(["P1", "P2", "P3"]),
  dueByTime: z.string().optional().nullable(),
  taskTypeId: z.string().optional().nullable(),
  keyResultId: z.string().optional().nullable(),
});

async function loadTaskForManagement(taskId: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const task = await prisma.dailyWorkTask.findUnique({
    where: { id: taskId },
    include: {
      assignee: {
        select: { id: true, departmentId: true, managerId: true, department: { select: { slug: true } } },
      },
    },
  });
  if (!task?.assignee.departmentId) throw new Error("Task not found");

  if (
    !canAssignDailyTasks({
      viewerRole: user.role,
      viewerPermissions: user.permissions,
      viewerUserId: user.id,
      viewerHeadedDepartmentId: user.headedDept?.id ?? null,
      assigneeManagerId: task.assignee.managerId,
      assigneeDepartmentId: task.assignee.departmentId,
    })
  ) {
    throw new Error("Forbidden");
  }

  if (task.eodStatus !== null) {
    throw new Error("Cannot change a task after EOD reporting");
  }

  const carriedCount = await prisma.dailyWorkTask.count({ where: { carriedFromTaskId: task.id } });
  if (carriedCount > 0) {
    throw new Error("Cannot change a task that was carried forward");
  }

  return task;
}

export async function updateDailyTask(formData: FormData) {
  const user = await requireUser();
  const quantityUnit = parseQuantityUnit(formData);
  if (!QUANTITY_UNIT_PRESETS.includes(quantityUnit as (typeof QUANTITY_UNIT_PRESETS)[number]) && quantityUnit.length > 40) {
    throw new Error("Invalid unit");
  }

  const parsed = updateTaskSchema.parse({
    taskId: formData.get("taskId"),
    projectName: formData.get("projectName"),
    targetQuantity: formData.get("targetQuantity"),
    quantityUnit,
    priority: formData.get("priority"),
    dueByTime: formData.get("dueByTime") || null,
    taskTypeId: formData.get("taskTypeId") || null,
    keyResultId: formData.get("keyResultId") || null,
  });

  const task = await loadTaskForManagement(parsed.taskId, user);
  const taskTypeId = await resolveTaskTypeId(
    task.departmentId,
    task.assignee.department?.slug ?? "general",
    parsed.taskTypeId,
  );

  const previousKeyResultId = task.keyResultId;
  await prisma.dailyWorkTask.update({
    where: { id: task.id },
    data: {
      projectName: parsed.projectName,
      targetQuantity: parsed.targetQuantity,
      quantityUnit: parsed.quantityUnit,
      priority: parsed.priority,
      dueByTime: parsed.dueByTime || null,
      taskTypeId,
      keyResultId: parsed.keyResultId || null,
    },
  });

  const keyResultIds = new Set<string>();
  if (previousKeyResultId) keyResultIds.add(previousKeyResultId);
  if (parsed.keyResultId) keyResultIds.add(parsed.keyResultId);
  for (const krId of keyResultIds) {
    await refreshKeyResultProgress(krId);
  }

  revalidatePath("/work");
  revalidatePath("/work/team");
  revalidatePath("/work/okrs");
}

const deleteTaskSchema = z.object({
  taskId: z.string().min(1),
});

export async function deleteDailyTask(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteTaskSchema.parse({ taskId: formData.get("taskId") });
  const task = await loadTaskForManagement(parsed.taskId, user);

  await prisma.dailyWorkTask.delete({ where: { id: task.id } });

  if (task.keyResultId) {
    await refreshKeyResultProgress(task.keyResultId);
  }

  revalidatePath("/work");
  revalidatePath("/work/team");
  revalidatePath("/work/okrs");
}

export async function createDeptTaskType(formData: FormData) {
  const user = await requireUser();
  const parsed = taskTypeSchema.parse({
    departmentId: formData.get("departmentId"),
    name: formData.get("name"),
    complexity: formData.get("complexity"),
  });

  const dept = await prisma.department.findUnique({ where: { id: parsed.departmentId } });
  if (!dept) throw new Error("Department not found");

  if (
    !canManageDeptOkrs({
      viewerRole: user.role,
      viewerHeadedDepartmentId: user.headedDept?.id ?? null,
      departmentId: parsed.departmentId,
    })
  ) {
    throw new Error("Forbidden");
  }

  await prisma.deptTaskType.create({
    data: {
      departmentId: parsed.departmentId,
      name: parsed.name,
      slug: slugifyDepartmentName(parsed.name),
      complexity: parsed.complexity,
    },
  });

  revalidatePath("/work/okrs");
  revalidatePath("/work/team");
}

export type ClientDailyWorkTask = {
  id: string;
  workDate: string;
  projectName: string;
  targetQuantity: number;
  quantityUnit: string;
  priority: string;
  dueByTime: string | null;
  eodStatus: string | null;
  actualQuantity: number | null;
  assigneeNotes: string | null;
  taskType: { name: string };
  keyResult: { title: string } | null;
  assignedBy: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  };
  assigneeId: string;
  attachments: {
    id: string;
    fileName: string;
    url: string;
    mimeType: string | null;
    sizeBytes: number | null;
    createdAt: string;
  }[];
  canEdit: boolean;
};

async function loadDailyTaskWithAccess(taskId: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const task = await prisma.dailyWorkTask.findUnique({
    where: { id: taskId },
    include: {
      taskType: { select: { name: true } },
      keyResult: { select: { title: true } },
      assignedBy: { select: { id: true, name: true, firstName: true, lastName: true } },
      assignee: { select: { id: true, managerId: true, departmentId: true } },
      attachments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          url: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
    },
  });
  if (!task?.assignee.departmentId) return null;

  const canView = canViewDailyWorkTask({
    viewerRole: user.role,
    viewerPermissions: user.permissions,
    viewerUserId: user.id,
    viewerHeadedDepartmentId: user.headedDept?.id ?? null,
    assigneeId: task.assigneeId,
    assigneeManagerId: task.assignee.managerId,
    assigneeDepartmentId: task.assignee.departmentId,
  });
  if (!canView) return null;

  return task;
}

function toClientDailyWorkTask(
  task: NonNullable<Awaited<ReturnType<typeof loadDailyTaskWithAccess>>>,
  viewerUserId: string,
): ClientDailyWorkTask {
  return {
    id: task.id,
    workDate: formatWorkDate(task.workDate),
    projectName: task.projectName,
    targetQuantity: Number(task.targetQuantity),
    quantityUnit: task.quantityUnit,
    priority: task.priority,
    dueByTime: task.dueByTime,
    eodStatus: task.eodStatus,
    actualQuantity: task.actualQuantity != null ? Number(task.actualQuantity) : null,
    assigneeNotes: task.assigneeNotes,
    taskType: task.taskType,
    keyResult: task.keyResult,
    assignedBy: task.assignedBy,
    assigneeId: task.assigneeId,
    attachments: task.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      url: a.url,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: a.createdAt.toISOString(),
    })),
    canEdit: canEditDailyWorkTaskDetails({ viewerUserId, assigneeId: task.assigneeId }),
  };
}

export async function loadDailyWorkTaskForClient(
  taskId: string,
): Promise<{ ok: true; task: ClientDailyWorkTask } | { ok: false; error: string }> {
  const user = await requireUser();
  const task = await loadDailyTaskWithAccess(taskId, user);
  if (!task) return { ok: false, error: "Task not found." };
  return { ok: true, task: toClientDailyWorkTask(task, user.id) };
}

const updateNotesSchema = z.object({
  taskId: z.string().min(1),
  notes: z.string().max(10000),
});

export async function updateDailyWorkTaskNotes(
  taskId: string,
  notes: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = updateNotesSchema.parse({ taskId, notes });

  const task = await loadDailyTaskWithAccess(parsed.taskId, user);
  if (!task) return { ok: false, error: "Task not found." };
  if (!canEditDailyWorkTaskDetails({ viewerUserId: user.id, assigneeId: task.assigneeId })) {
    return { ok: false, error: "Forbidden" };
  }

  await prisma.dailyWorkTask.update({
    where: { id: task.id },
    data: { assigneeNotes: parsed.notes.trim() || null },
  });

  revalidatePath("/work");
  revalidatePath("/work/team");
  return { ok: true };
}

export async function addDailyWorkTaskAttachment(
  taskId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const task = await loadDailyTaskWithAccess(taskId, user);
  if (!task) return { ok: false, error: "Task not found." };
  if (!canEditDailyWorkTaskDetails({ viewerUserId: user.id, assigneeId: task.assigneeId })) {
    return { ok: false, error: "Forbidden" };
  }

  const file = formData.get("file");
  const stored = await persistTaskAttachmentFile(file);
  if (!stored.ok) {
    const msg =
      stored.code === "TOO_LARGE"
        ? "File too large (max 15 MB)."
        : stored.code === "STORAGE"
          ? "Could not upload (check storage env vars)."
          : "Unsupported type (PDF, Word, images, TXT, MD).";
    return { ok: false, error: msg };
  }

  await prisma.dailyWorkTaskAttachment.create({
    data: {
      taskId: task.id,
      url: stored.url.slice(0, 2048),
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      sizeBytes: stored.size,
      uploadedById: user.id,
    },
  });

  revalidatePath("/work");
  revalidatePath("/work/team");
  return { ok: true };
}

export async function deleteDailyWorkTaskAttachment(
  attachmentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  const attachment = await prisma.dailyWorkTaskAttachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, taskId: true },
  });
  if (!attachment) return { ok: false, error: "Attachment not found." };

  const task = await loadDailyTaskWithAccess(attachment.taskId, user);
  if (!task) return { ok: false, error: "Task not found." };
  if (!canEditDailyWorkTaskDetails({ viewerUserId: user.id, assigneeId: task.assigneeId })) {
    return { ok: false, error: "Forbidden" };
  }

  await prisma.dailyWorkTaskAttachment.delete({ where: { id: attachmentId } });

  revalidatePath("/work");
  revalidatePath("/work/team");
  return { ok: true };
}

