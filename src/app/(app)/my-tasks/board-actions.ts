"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { getOrCreatePersonalTaskBoard } from "@/lib/personal-task-board-setup";
import { serializePersonalBoardForClient } from "@/lib/personal-board-client";
import { createNotification } from "@/lib/notifications";
import { calendarDateFromInput } from "@/lib/calendar-date";
import {
  canAssignPersonalTasks,
  canDeletePersonalTask,
  canEditPersonalTask,
  canViewPersonalTask,
  canViewPersonalTasks,
} from "@/lib/personal-tasks-access";
import type { ClientBoard } from "./task-kanban-types";
import { persistTaskAttachmentFile } from "@/lib/task-attachment-upload";
import type { ClientBoardTask } from "./task-kanban-types";

const PATH = "/my-tasks";

async function sessionViewer() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true, permissions: true, headedDept: { select: { id: true } } },
  });
}

async function hasExplicitTaskBoardGrant(ownerUserId: string, viewerUserId: string): Promise<boolean> {
  if (!ownerUserId || !viewerUserId) return false;
  const row = await prisma.personalTaskBoardViewer.findUnique({
    where: { ownerUserId_viewerUserId: { ownerUserId, viewerUserId } },
    select: { id: true },
  });
  return !!row;
}

async function requireOwner(ownerUserId: string) {
  const v = await sessionViewer();
  if (!v || v.id !== ownerUserId) return null;
  return v;
}

async function viewerCanComment(
  viewerId: string,
  viewerRole: Role,
  viewerPermissions: string[] | null,
  headedDeptId: string | null,
  taskId: string,
) {
  const t = await prisma.personalTask.findUnique({
    where: { id: taskId },
    select: {
      assignedByUserId: true,
      board: {
        select: {
          ownerUserId: true,
          owner: { select: { managerId: true, departmentId: true } },
        },
      },
    },
  });
  if (!t) return false;

  const isMember = !!(await prisma.personalTaskMember.findUnique({
    where: { taskId_userId: { taskId, userId: viewerId } },
    select: { id: true },
  }));
  if (isMember) return true;

  const hasExplicitGrant = await hasExplicitTaskBoardGrant(t.board.ownerUserId, viewerId);
  return canViewPersonalTask({
    viewerUserId: viewerId,
    viewerRole,
    viewerPermissions,
    ownerUserId: t.board.ownerUserId,
    ownerManagerId: t.board.owner.managerId,
    ownerDepartmentId: t.board.owner.departmentId,
    viewerHeadedDepartmentId: headedDeptId,
    assignedByUserId: t.assignedByUserId,
    hasExplicitGrant,
  });
}

async function getTaskAccess(
  taskId: string,
  viewerId: string,
  viewerRole: Role,
  viewerPermissions: string[] | null,
  headedDeptId: string | null,
) {
  const task = await prisma.personalTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      boardId: true,
      stageId: true,
      assignedToUserId: true,
      assignedByUserId: true,
      title: true,
      board: {
        select: {
          ownerUserId: true,
          owner: {
            select: {
              managerId: true,
              departmentId: true,
            },
          },
        },
      },
    },
  });

  if (!task) return null;

  const isMember = !!(await prisma.personalTaskMember.findUnique({
    where: { taskId_userId: { taskId, userId: viewerId } },
    select: { id: true },
  }));

  const canEdit = canEditPersonalTask({
    viewerUserId: viewerId,
    ownerUserId: task.board.ownerUserId,
    assignedByUserId: task.assignedByUserId,
  });

  const canView =
    isMember ||
    canViewPersonalTask({
      viewerUserId: viewerId,
      viewerRole,
      viewerPermissions,
      ownerUserId: task.board.ownerUserId,
      ownerManagerId: task.board.owner.managerId,
      ownerDepartmentId: task.board.owner.departmentId,
      viewerHeadedDepartmentId: headedDeptId,
      assignedByUserId: task.assignedByUserId,
      hasExplicitGrant: await hasExplicitTaskBoardGrant(task.board.ownerUserId, viewerId),
    });

  return { task, canEdit, canView };
}

function nu(s: unknown, max?: number): string {
  const t = typeof s === "string" ? s.trim() : "";
  if (!max) return t;
  return t.slice(0, max);
}

function revalidateTasks() {
  revalidatePath(PATH);
}

async function notifyTaskParticipants(args: {
  task: { id: string; title: string; assignedToUserId: string; assignedByUserId: string | null };
  actorUserId: string;
  kind: "TASK_ASSIGNED" | "TASK_MOVED" | "TASK_COMMENT";
  title: string;
  body?: string | null;
  href?: string | null;
  meta?: unknown;
}) {
  const recipients = new Set<string>();
  if (args.task.assignedToUserId) recipients.add(args.task.assignedToUserId);
  if (args.task.assignedByUserId) recipients.add(args.task.assignedByUserId);

  const members = await prisma.personalTaskMember.findMany({
    where: { taskId: args.task.id },
    select: { userId: true },
  });
  for (const m of members) {
    if (m.userId) recipients.add(m.userId);
  }

  recipients.delete(args.actorUserId);
  if (recipients.size === 0) return;

  try {
    await Promise.allSettled(
      Array.from(recipients).map((userId) =>
        createNotification({
          userId,
          kind: args.kind,
          title: args.title,
          body: args.body ?? null,
          href: args.href ?? null,
          actorUserId: args.actorUserId,
          meta: args.meta ?? undefined,
        }),
      ),
    );
  } catch {
    // non-critical
  }
}

/** Load someone’s task board for the team-member overlay (respects the same rules as the old /my-tasks?userId= flow). */
export async function loadPersonalTaskBoardForModal(
  peerUserId: string,
): Promise<{ ok: true; board: ClientBoard } | { ok: false; error: string }> {
  const v = await sessionViewer();
  if (!v) return { ok: false, error: "Unauthorized" };

  const owner = await prisma.user.findUnique({
    where: { id: peerUserId },
    select: {
      id: true,
      status: true,
      managerId: true,
      departmentId: true,
    },
  });
  if (!owner || owner.status === "EXITED") return { ok: false, error: "Person not found." };

  const okView = canViewPersonalTasks({
    viewerUserId: v.id,
    viewerRole: v.role as Role,
    viewerPermissions: v.permissions ?? null,
    ownerUserId: owner.id,
    ownerManagerId: owner.managerId,
    ownerDepartmentId: owner.departmentId,
    viewerHeadedDepartmentId: v.headedDept?.id ?? null,
    hasExplicitGrant: await hasExplicitTaskBoardGrant(owner.id, v.id),
  });
  const canTrackAssignedTasks = canAssignPersonalTasks({
    viewerUserId: v.id,
    viewerStatus: v.status,
    assigneeUserId: owner.id,
    assigneeStatus: owner.status,
  });
  const hasMemberTasks = !!(await prisma.personalTaskMember.findFirst({
    where: { userId: v.id, task: { assignedToUserId: owner.id } },
    select: { id: true },
  }));
  if (!okView && !canTrackAssignedTasks && !hasMemberTasks) return { ok: false, error: "You can’t view this board." };

  const boardPayload = await getOrCreatePersonalTaskBoard(peerUserId);
  const visibleBoard = okView
    ? boardPayload
    : {
        ...boardPayload,
        tasks: boardPayload.tasks.filter(
          (task) => (canTrackAssignedTasks && task.assignedByUserId === v.id) || task.members.some((m) => m.user.id === v.id),
        ),
      };
  return { ok: true, board: serializePersonalBoardForClient(visibleBoard) };
}

export async function assignTaskToUser(
  formData: FormData,
): Promise<{ ok: boolean; error?: string; userId?: string; taskId?: string }> {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false, error: "Unauthorized" };

  const title = nu(formData.get("title"), 500);
  const description = nu(formData.get("description"), 32000);
  const assignedToUserId = nu(formData.get("assignedToUserId"), 191);
  if (!title.length) return { ok: false, error: "Task title is required." };
  if (!assignedToUserId.length) return { ok: false, error: "Choose a teammate." };

  const assignee = await prisma.user.findUnique({
    where: { id: assignedToUserId },
    select: { id: true, status: true },
  });
  if (!assignee || assignee.status !== "ACTIVE") {
    return { ok: false, error: "Assignee not found." };
  }

  const canAssign = canAssignPersonalTasks({
    viewerUserId: viewer.id,
    viewerStatus: viewer.status,
    assigneeUserId: assignee.id,
    assigneeStatus: assignee.status,
  });
  if (!canAssign) return { ok: false, error: "You can’t assign tasks right now." };

  const board = await getOrCreatePersonalTaskBoard(assignee.id);
  const targetStage =
    board.stages.find((stage) => !stage.isFinishedColumn) ??
    board.stages[0];
  if (!targetStage) return { ok: false, error: "No stage available on that board." };

  const agg = await prisma.personalTask.aggregate({
    where: { stageId: targetStage.id },
    _max: { sortOrder: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.personalTask.create({
      data: {
        boardId: board.id,
        stageId: targetStage.id,
        title,
        description: description.length > 0 ? description : null,
        sortOrder: (agg._max.sortOrder ?? 0) + 1,
        assignedToUserId: assignee.id,
        assignedByUserId: viewer.id,
      },
    });
    await tx.personalTaskBoard.update({
      where: { id: board.id },
      data: { updatedAt: new Date() },
    });
    return task;
  });

  revalidateTasks();

  if (assignee.id !== viewer.id) {
    try {
      await createNotification({
        userId: assignee.id,
        kind: "TASK_ASSIGNED",
        title: "You were assigned a task",
        body: `You have been assigned task: ${title}`,
        href: `/my-tasks?task=${encodeURIComponent(created.id)}`,
        actorUserId: viewer.id,
        meta: { taskId: created.id },
      });
    } catch {
      // non-critical
    }
  }
  return { ok: true, userId: assignee.id, taskId: created.id };
}

export async function updateBoardTaskStage(taskId: string, stageId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  const targetStage = await prisma.personalTaskStage.findFirst({
    where: { id: stageId, board: { ownerUserId: access.task.assignedToUserId } },
    select: { id: true, title: true },
  });
  if (!targetStage) return { ok: false as const, error: "Stage not found." };

  const agg = await prisma.personalTask.aggregate({
    where: { stageId },
    _max: { sortOrder: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.personalTask.update({
      where: { id: taskId },
      data: {
        stageId,
        sortOrder: (agg._max.sortOrder ?? 0) + 1,
      },
    });
    await tx.personalTaskBoard.update({
      where: { id: access.task.boardId },
      data: { updatedAt: new Date() },
    });
  });

  revalidateTasks();

  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task moved",
    body: `${access.task.title} → ${targetStage.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, stageId: targetStage.id },
  });
  return { ok: true as const };
}

export async function persistBoardLayout(ownerUserId: string, layout: Record<string, string[]>) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false as const };

  const board = await prisma.personalTaskBoard.findUnique({
    where: { ownerUserId },
    select: {
      id: true,
      stages: { select: { id: true, title: true } },
      tasks: { select: { id: true, stageId: true, title: true, assignedToUserId: true, assignedByUserId: true } },
    },
  });
  if (!board) return { ok: false as const };

  const stageIds = new Set(board.stages.map((s) => s.id));
  const taskIdsValid = new Set(board.tasks.map((t) => t.id));

  const assignments: { taskId: string; stageId: string; sortOrder: number }[] = [];
  const seen = new Set<string>();

  const nextStageByTaskId = new Map<string, string>();
  for (const [stageId, ids] of Object.entries(layout)) {
    if (!stageIds.has(stageId)) continue;
    ids.forEach((taskId, i) => {
      if (!taskIdsValid.has(taskId)) return;
      if (seen.has(taskId)) return;
      seen.add(taskId);
      assignments.push({ taskId, stageId, sortOrder: i });
      nextStageByTaskId.set(taskId, stageId);
    });
  }

  if (seen.size !== taskIdsValid.size) return { ok: false as const };

  const stageTitleById = new Map(board.stages.map((s) => [s.id, s.title]));
  const moved = board.tasks
    .map((t) => {
      const nextStageId = nextStageByTaskId.get(t.id) ?? t.stageId;
      return {
        task: t,
        nextStageId,
        nextStageTitle: stageTitleById.get(nextStageId) ?? "Unknown",
        changed: nextStageId !== t.stageId,
      };
    })
    .filter((m) => m.changed);

  await prisma.$transaction(
    assignments.map((a) =>
      prisma.personalTask.updateMany({
        where: { id: a.taskId, boardId: board.id },
        data: { stageId: a.stageId, sortOrder: a.sortOrder },
      }),
    ),
  );

  revalidateTasks();

  if (moved.length > 0) {
    await Promise.allSettled(
      moved.map((m) =>
        notifyTaskParticipants({
          task: m.task,
          actorUserId: viewer.id,
          kind: "TASK_MOVED",
          title: "Task moved",
          body: `${m.task.title} → ${m.nextStageTitle}`,
          href: `/my-tasks?userId=${encodeURIComponent(m.task.assignedToUserId)}&task=${encodeURIComponent(m.task.id)}`,
          meta: { taskId: m.task.id, stageId: m.nextStageId },
        }),
      ),
    );
  }
  return { ok: true as const };
}

export async function addBoardTask(
  ownerUserId: string,
  stageId: string,
  formData: FormData,
): Promise<{ ok: boolean; task?: ClientBoard["tasks"][number] }> {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false };

  const title = nu(formData.get("title"), 500);
  if (!title.length) return { ok: false };

  const board = await prisma.personalTaskBoard.findFirst({
    where: { ownerUserId, stages: { some: { id: stageId } } },
    select: { id: true },
  });
  if (!board) return { ok: false };

  const agg = await prisma.personalTask.aggregate({
    where: { stageId },
    _max: { sortOrder: true },
  });

  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.personalTask.create({
      data: {
        boardId: board.id,
        stageId,
        title,
        sortOrder: (agg._max.sortOrder ?? 0) + 1,
        assignedToUserId: ownerUserId,
        assignedByUserId: viewer.id,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            email: true,
            image: true,
          },
        },
      },
    });
    await tx.personalTaskBoard.update({
      where: { id: board.id },
      data: { updatedAt: new Date() },
    });
    return task;
  });
  revalidateTasks();
  return {
    ok: true,
    task: {
      id: created.id,
      stageId: created.stageId,
      title: created.title,
      description: created.description,
      dueDate: created.dueDate ? created.dueDate.toISOString() : null,
      sortOrder: created.sortOrder,
      assignedTo: {
        id: created.assignedTo.id,
        name: created.assignedTo.name,
        firstName: created.assignedTo.firstName,
        lastName: created.assignedTo.lastName,
        email: created.assignedTo.email,
        image: created.assignedTo.image,
      },
      assignedBy: created.assignedBy
        ? {
            id: created.assignedBy.id,
            name: created.assignedBy.name,
            firstName: created.assignedBy.firstName,
            lastName: created.assignedBy.lastName,
            email: created.assignedBy.email,
            image: created.assignedBy.image,
          }
        : null,
      attachments: [],
      comments: [],
      members: [],
      labels: [],
      checklists: [],
    },
  };
}

export async function deleteBoardTask(ownerUserId: string, taskId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return;
  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canView) return;
  const canDelete = canDeletePersonalTask({
    viewerUserId: viewer.id,
    ownerUserId: access.task.assignedToUserId,
    assignedByUserId: access.task.assignedByUserId,
  });
  if (!canDelete) return;
  await prisma.personalTask.delete({ where: { id: taskId } });
  revalidateTasks();
}

export async function reassignBoardTask(taskId: string, nextAssignedToUserId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const targetId = nu(nextAssignedToUserId, 191);
  if (!targetId.length) return { ok: false as const, error: "Choose a teammate." };

  const current = await prisma.personalTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      boardId: true,
      assignedToUserId: true,
      assignedByUserId: true,
    },
  });
  if (!current) return { ok: false as const, error: "Task not found." };

  if (!current.assignedByUserId || current.assignedByUserId !== viewer.id) {
    return { ok: false as const, error: "No access." };
  }

  if (current.assignedToUserId === targetId) return { ok: true as const };

  const assignee = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, status: true },
  });
  if (!assignee || assignee.status !== "ACTIVE") {
    return { ok: false as const, error: "Assignee not found." };
  }

  const canAssign = canAssignPersonalTasks({
    viewerUserId: viewer.id,
    viewerStatus: viewer.status,
    assigneeUserId: assignee.id,
    assigneeStatus: assignee.status,
  });
  if (!canAssign) return { ok: false as const, error: "You can’t assign tasks right now." };

  const nextBoard = await getOrCreatePersonalTaskBoard(assignee.id);
  const targetStage =
    nextBoard.stages.find((stage) => !stage.isFinishedColumn) ??
    nextBoard.stages[0];
  if (!targetStage) return { ok: false as const, error: "No stage available on that board." };

  const agg = await prisma.personalTask.aggregate({
    where: { stageId: targetStage.id },
    _max: { sortOrder: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.personalTask.update({
      where: { id: current.id },
      data: {
        boardId: nextBoard.id,
        stageId: targetStage.id,
        sortOrder: (agg._max.sortOrder ?? 0) + 1,
        assignedToUserId: assignee.id,
      },
    });

    await tx.personalTaskBoard.update({
      where: { id: current.boardId },
      data: { updatedAt: new Date() },
    });
    await tx.personalTaskBoard.update({
      where: { id: nextBoard.id },
      data: { updatedAt: new Date() },
    });
  });

  revalidateTasks();

  try {
    await createNotification({
      userId: assignee.id,
      kind: "TASK_ASSIGNED",
      title: "You were assigned a task",
      body: `You have been assigned task: ${current.title}`,
      href: `/my-tasks?task=${encodeURIComponent(current.id)}`,
      actorUserId: viewer.id,
      meta: { taskId: current.id },
    });
  } catch {
    // non-critical
  }

  return { ok: true as const, assignedToUserId: assignee.id };
}

export async function updateBoardTaskDetails(ownerUserId: string, taskId: string, formData: FormData) {
  const viewer = await sessionViewer();
  if (!viewer) return;
  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return;
  const titleRaw = formData.get("title");
  const title = typeof titleRaw === "string" ? titleRaw.trim().slice(0, 500) : "";
  const descriptionRaw = nu(formData.get("description"), 32000);

  const data: { title?: string; description?: string | null } = {};
  if (title.length > 0) data.title = title;
  if (formData.has("description")) {
    data.description = descriptionRaw.length > 0 ? descriptionRaw : null;
  }

  if (Object.keys(data).length === 0) return;

  await prisma.personalTask.updateMany({
    where: { id: taskId },
    data,
  });
  revalidateTasks();

  const nextTitle = (data.title ?? access.task.title).trim();
  await notifyTaskParticipants({
    task: { ...access.task, title: nextTitle.length ? nextTitle : access.task.title },
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Details updated — ${nextTitle.length ? nextTitle : access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "details" },
  });
}

export async function setTaskDueDate(taskId: string, dueDateYmd: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };
  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  const raw = (dueDateYmd ?? "").trim();
  const next = raw.length === 0 ? null : calendarDateFromInput(raw);
  if (next && Number.isNaN(next.getTime())) return { ok: false as const, error: "Invalid date." };

  await prisma.$transaction(async (tx) => {
    await tx.personalTask.update({
      where: { id: taskId },
      data: { dueDate: next },
    });
    await tx.personalTaskBoard.update({
      where: { id: access.task.boardId },
      data: { updatedAt: new Date() },
    });
  });

  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Due date ${raw.length ? "updated" : "cleared"} — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "dueDate" },
  });
  return { ok: true as const };
}

export async function createBoardLabel(ownerUserId: string, name: string, color: string) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const n = nu(name, 80);
  const c = nu(color, 32);
  if (!n.length) return { ok: false as const, error: "Label name is required." };
  if (!c.length) return { ok: false as const, error: "Color is required." };

  const board = await prisma.personalTaskBoard.findUnique({
    where: { ownerUserId },
    select: { id: true, _count: { select: { labels: true } } },
  });
  if (!board) return { ok: false as const, error: "Board not found." };

  const created = await prisma.personalTaskLabel.create({
    data: {
      boardId: board.id,
      name: n,
      color: c,
      sortOrder: board._count.labels,
    },
    select: { id: true, name: true, color: true, sortOrder: true },
  });

  revalidateTasks();
  return { ok: true as const, label: created };
}

export async function setTaskLabels(taskId: string, labelIds: string[]) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };
  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  const ids = Array.from(new Set((labelIds ?? []).filter((id) => typeof id === "string" && id.trim().length > 0)));

  const board = await prisma.personalTaskBoard.findUnique({
    where: { id: access.task.boardId },
    select: { id: true },
  });
  if (!board) return { ok: false as const, error: "Board not found." };

  const validLabels = ids.length
    ? await prisma.personalTaskLabel.findMany({
        where: { id: { in: ids }, boardId: board.id },
        select: { id: true },
      })
    : [];
  const validIds = validLabels.map((l) => l.id);

  await prisma.$transaction(async (tx) => {
    await tx.personalTaskLabelAssignment.deleteMany({ where: { taskId } });
    if (validIds.length > 0) {
      await tx.personalTaskLabelAssignment.createMany({
        data: validIds.map((labelId) => ({ taskId, labelId })),
        skipDuplicates: true,
      });
    }
    await tx.personalTaskBoard.update({ where: { id: board.id }, data: { updatedAt: new Date() } });
  });

  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Labels updated — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "labels" },
  });
  return { ok: true as const };
}

export async function addTaskMember(taskId: string, userId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };
  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  const targetId = nu(userId, 191);
  if (!targetId.length) return { ok: false as const, error: "Choose a person." };

  const u = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, status: true },
  });
  if (!u || u.status !== "ACTIVE") return { ok: false as const, error: "Person not found." };

  await prisma.$transaction(async (tx) => {
    await tx.personalTaskMember.createMany({
      data: [{ taskId, userId: u.id }],
      skipDuplicates: true,
    });
    await tx.personalTaskBoard.update({
      where: { id: access.task.boardId },
      data: { updatedAt: new Date() },
    });
  });

  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Members updated — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "members" },
  });
  return { ok: true as const };
}

export async function removeTaskMember(taskId: string, userId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };
  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  const targetId = nu(userId, 191);
  if (!targetId.length) return { ok: false as const, error: "Choose a person." };

  await prisma.$transaction(async (tx) => {
    await tx.personalTaskMember.deleteMany({ where: { taskId, userId: targetId } });
    await tx.personalTaskBoard.update({
      where: { id: access.task.boardId },
      data: { updatedAt: new Date() },
    });
  });

  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Members updated — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "members" },
  });
  return { ok: true as const };
}

export async function createTaskChecklist(taskId: string, title?: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };
  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  const agg = await prisma.personalTaskChecklist.aggregate({
    where: { taskId },
    _max: { sortOrder: true },
  });

  const t = nu(title ?? "Checklist", 160);
  const created = await prisma.personalTaskChecklist.create({
    data: {
      taskId,
      title: t.length ? t : "Checklist",
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  await prisma.personalTaskBoard.update({ where: { id: access.task.boardId }, data: { updatedAt: new Date() } });
  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Checklist added — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "checklists" },
  });
  return { ok: true as const, checklistId: created.id };
}

export async function renameChecklist(checklistId: string, title: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const row = await prisma.personalTaskChecklist.findUnique({
    where: { id: checklistId },
    select: { id: true, taskId: true },
  });
  if (!row) return { ok: false as const, error: "Checklist not found." };

  const access = await getTaskAccess(row.taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  const t = nu(title, 160);
  if (!t.length) return { ok: false as const, error: "Title is required." };

  await prisma.$transaction(async (tx) => {
    await tx.personalTaskChecklist.update({ where: { id: row.id }, data: { title: t } });
    await tx.personalTaskBoard.update({ where: { id: access.task.boardId }, data: { updatedAt: new Date() } });
  });
  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Checklist updated — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "checklists" },
  });
  return { ok: true as const };
}

export async function deleteChecklist(checklistId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const row = await prisma.personalTaskChecklist.findUnique({
    where: { id: checklistId },
    select: { id: true, taskId: true },
  });
  if (!row) return { ok: false as const, error: "Checklist not found." };

  const access = await getTaskAccess(row.taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  await prisma.$transaction(async (tx) => {
    await tx.personalTaskChecklist.delete({ where: { id: row.id } });
    await tx.personalTaskBoard.update({ where: { id: access.task.boardId }, data: { updatedAt: new Date() } });
  });
  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Checklist updated — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "checklists" },
  });
  return { ok: true as const };
}

export async function addChecklistItem(checklistId: string, body: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const row = await prisma.personalTaskChecklist.findUnique({
    where: { id: checklistId },
    select: { id: true, taskId: true },
  });
  if (!row) return { ok: false as const, error: "Checklist not found." };

  const access = await getTaskAccess(row.taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  const b = nu(body, 5000);
  if (!b.length) return { ok: false as const, error: "Item text is required." };

  const agg = await prisma.personalTaskChecklistItem.aggregate({
    where: { checklistId: row.id },
    _max: { sortOrder: true },
  });

  const created = await prisma.personalTaskChecklistItem.create({
    data: {
      checklistId: row.id,
      body: b,
      sortOrder: (agg._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  await prisma.personalTaskBoard.update({ where: { id: access.task.boardId }, data: { updatedAt: new Date() } });
  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Checklist updated — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "checklists" },
  });
  return { ok: true as const, itemId: created.id };
}

export async function toggleChecklistItem(itemId: string, isDone: boolean) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const row = await prisma.personalTaskChecklistItem.findUnique({
    where: { id: itemId },
    select: { id: true, checklist: { select: { id: true, taskId: true } } },
  });
  if (!row) return { ok: false as const, error: "Item not found." };

  const access = await getTaskAccess(row.checklist.taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  await prisma.$transaction(async (tx) => {
    await tx.personalTaskChecklistItem.update({
      where: { id: row.id },
      data: { isDone, completedAt: isDone ? new Date() : null },
    });
    await tx.personalTaskBoard.update({ where: { id: access.task.boardId }, data: { updatedAt: new Date() } });
  });
  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Checklist updated — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "checklists" },
  });
  return { ok: true as const };
}

export async function deleteChecklistItem(itemId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const row = await prisma.personalTaskChecklistItem.findUnique({
    where: { id: itemId },
    select: { id: true, checklist: { select: { taskId: true } } },
  });
  if (!row) return { ok: false as const, error: "Item not found." };

  const access = await getTaskAccess(row.checklist.taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  await prisma.$transaction(async (tx) => {
    await tx.personalTaskChecklistItem.delete({ where: { id: row.id } });
    await tx.personalTaskBoard.update({ where: { id: access.task.boardId }, data: { updatedAt: new Date() } });
  });
  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Checklist updated — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "checklists" },
  });
  return { ok: true as const };
}

export async function createPersonalTaskStage(ownerUserId: string, formData?: FormData) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const board = await getOrCreatePersonalTaskBoard(ownerUserId);
  if (board.stages.length >= 20) return { ok: false as const, error: "Max 20 stages per board." };

  const requested = formData ? nu(formData.get("title"), 160) : "";
  const title = requested.length ? requested : `New stage ${board.stages.length + 1}`;

  const max = board.stages.reduce((m, s) => Math.max(m, s.sortOrder), -1);

  await prisma.personalTaskStage.create({
    data: { boardId: board.id, title, sortOrder: max + 1, isFinishedColumn: false },
  });
  revalidateTasks();
  return { ok: true as const };
}


export async function renamePersonalTaskStage(ownerUserId: string, stageId: string, title: string) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false as const };
  const t = title.trim().slice(0, 160);
  if (!t.length) return { ok: false as const };

  const updated = await prisma.personalTaskStage.updateMany({
    where: { id: stageId, board: { ownerUserId } },
    data: { title: t },
  });
  if (updated.count !== 1) return { ok: false as const };
  revalidateTasks();
  return { ok: true as const };
}

export async function setPersonalTaskStageFinishedFlag(
  ownerUserId: string,
  stageId: string,
  isFinishedColumn: boolean,
) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false as const };
  await prisma.personalTaskStage.updateMany({
    where: { id: stageId, board: { ownerUserId } },
    data: { isFinishedColumn },
  });
  revalidateTasks();
  return { ok: true as const };
}

export async function deletePersonalTaskStage(ownerUserId: string, stageId: string): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false, error: "Unauthorized" };

  const board = await prisma.personalTaskBoard.findUnique({
    where: { ownerUserId },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
  if (!board || board.stages.length < 2) {
    return { ok: false, error: "Keep at least one stage on the board." };
  }

  const stageRow = board.stages.find((s) => s.id === stageId);
  if (!stageRow) return { ok: false, error: "Stage not found." };

  const ct = await prisma.personalTask.count({ where: { stageId } });
  if (ct > 0) {
    return { ok: false, error: `Move or delete ${ct} task${ct === 1 ? "" : "s"} from this stage first.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.personalTaskStage.delete({ where: { id: stageId } });
    const remaining = await tx.personalTaskStage.findMany({
      where: { boardId: board.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    await Promise.all(
      remaining.map((row, idx) =>
        tx.personalTaskStage.update({
          where: { id: row.id },
          data: { sortOrder: idx },
        }),
      ),
    );
  });

  revalidateTasks();
  return { ok: true };
}

export async function reorderPersonalTaskStages(ownerUserId: string, orderedStageIds: string[]) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false as const };

  const board = await prisma.personalTaskBoard.findUnique({
    where: { ownerUserId },
    include: { stages: { select: { id: true } } },
  });
  if (!board) return { ok: false as const };

  const ids = new Set(board.stages.map((s) => s.id));
  if (orderedStageIds.some((id) => !ids.has(id)) || orderedStageIds.length !== ids.size) {
    return { ok: false as const };
  }

  await prisma.$transaction(
    orderedStageIds.map((id, idx) =>
      prisma.personalTaskStage.updateMany({
        where: { id, boardId: board.id },
        data: { sortOrder: idx },
      }),
    ),
  );
  revalidateTasks();
  return { ok: true as const };
}

export async function shiftPersonalTaskStage(ownerUserId: string, stageId: string, direction: -1 | 1) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false as const };

  const board = await prisma.personalTaskBoard.findUnique({
    where: { ownerUserId },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
  if (!board) return { ok: false as const };
  const idx = board.stages.findIndex((s) => s.id === stageId);
  const nj = idx + direction;
  if (idx === -1 || nj < 0 || nj >= board.stages.length) return { ok: false as const };
  const next = [...board.stages.map((s) => s.id)];
  const swap = next[idx];
  next[idx] = next[nj];
  next[nj] = swap;
  return reorderPersonalTaskStages(ownerUserId, next);
}

export async function addTaskComment(taskId: string, formData: FormData) {
  const v = await sessionViewer();
  if (!v) return { ok: false as const, error: "Unauthorized" };

  const bodyRaw = nu(formData.get("body"), 16000);
  if (bodyRaw.length < 2) return { ok: false as const, error: "Comment is too short." };

  const ok = await viewerCanComment(v.id, v.role as Role, v.permissions ?? null, v.headedDept?.id ?? null, taskId);
  if (!ok) return { ok: false as const, error: "No access." };

  await prisma.personalTaskComment.create({
    data: { taskId, authorId: v.id, body: bodyRaw },
  });
  revalidateTasks();

  try {
    const task = await prisma.personalTask.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, assignedToUserId: true, assignedByUserId: true },
    });
    if (task) {
      await notifyTaskParticipants({
        task,
        actorUserId: v.id,
        kind: "TASK_COMMENT",
        title: "New comment on a task",
        body: task.title,
        href: `/my-tasks?userId=${encodeURIComponent(task.assignedToUserId)}&task=${encodeURIComponent(taskId)}`,
        meta: { taskId },
      });
    }
  } catch {
    // non-critical
  }
  return { ok: true as const };
}

export async function deleteTaskComment(commentId: string) {
  const v = await sessionViewer();
  if (!v) return { ok: false as const };

  const row = await prisma.personalTaskComment.findUnique({
    where: { id: commentId },
    include: {
      task: {
        include: {
          board: {
            select: {
              ownerUserId: true,
            },
          },
        },
      },
    },
  });
  if (!row) return { ok: false as const };

  const canEditTask = canEditPersonalTask({
    viewerUserId: v.id,
    ownerUserId: row.task.board.ownerUserId,
    assignedByUserId: row.task.assignedByUserId,
  });
  if (row.authorId !== v.id && !canEditTask) return { ok: false as const };

  await prisma.personalTaskComment.delete({ where: { id: commentId } });
  revalidateTasks();
  return { ok: true as const };
}

export async function loadBoardTaskForClient(taskId: string): Promise<
  | { ok: true; task: ClientBoardTask }
  | { ok: false; error: string }
> {
  const v = await sessionViewer();
  if (!v) return { ok: false, error: "Unauthorized" };

  const access = await getTaskAccess(taskId, v.id, v.role as Role, v.permissions ?? null, v.headedDept?.id ?? null);
  if (!access?.canView) return { ok: false, error: "No access." };

  const task = await prisma.personalTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      stageId: true,
      title: true,
      description: true,
      dueDate: true,
      sortOrder: true,
      assignedTo: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          image: true,
        },
      },
      assignedBy: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          image: true,
        },
      },
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
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorId: true,
          body: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              image: true,
            },
          },
        },
      },
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              firstName: true,
              lastName: true,
              email: true,
              image: true,
            },
          },
        },
      },
      labelAssignments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          label: {
            select: { id: true, name: true, color: true, sortOrder: true },
          },
        },
      },
      checklists: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          sortOrder: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              body: true,
              isDone: true,
              sortOrder: true,
            },
          },
        },
      },
    },
  });
  if (!task) return { ok: false, error: "Task not found." };

  return {
    ok: true,
    task: {
      id: task.id,
      stageId: task.stageId,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      sortOrder: task.sortOrder,
      assignedTo: task.assignedTo,
      assignedBy: task.assignedBy,
      attachments: task.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        url: a.url,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
      comments: task.comments.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        author: c.author,
      })),
      members: task.members.map((m) => m.user),
      labels: task.labelAssignments
        .map((a) => a.label)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l) => ({ id: l.id, name: l.name, color: l.color })),
      checklists: task.checklists.map((c) => ({
        id: c.id,
        title: c.title,
        items: c.items.map((it) => ({ id: it.id, body: it.body, isDone: it.isDone, sortOrder: it.sortOrder })),
      })),
    } as unknown as ClientBoardTask,
  };
}

export async function addPersonalTaskAttachment(
  ownerUserId: string,
  taskId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false, error: "Unauthorized" };

  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false, error: "Task not found." };

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

  await prisma.personalTaskAttachment.create({
    data: {
      taskId,
      url: stored.url.slice(0, 2048),
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      sizeBytes: stored.size,
      uploadedById: viewer.id,
    },
  });
  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Attachment added — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "attachments" },
  });
  return { ok: true };
}

export async function deletePersonalTaskAttachment(ownerUserId: string, attachmentId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const };

  const attachment = await prisma.personalTaskAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      taskId: true,
    },
  });
  if (!attachment) return { ok: false as const };

  const access = await getTaskAccess(attachment.taskId, viewer.id, viewer.role as Role, viewer.permissions ?? null, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const };

  await prisma.personalTaskAttachment.delete({ where: { id: attachmentId } });
  revalidateTasks();
  await notifyTaskParticipants({
    task: access.task,
    actorUserId: viewer.id,
    kind: "TASK_MOVED",
    title: "Task updated",
    body: `Attachment removed — ${access.task.title}`,
    href: `/my-tasks?userId=${encodeURIComponent(access.task.assignedToUserId)}&task=${encodeURIComponent(access.task.id)}`,
    meta: { taskId: access.task.id, change: "attachments" },
  });
  return { ok: true as const };
}
