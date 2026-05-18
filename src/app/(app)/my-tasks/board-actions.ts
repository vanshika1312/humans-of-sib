"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { getOrCreatePersonalTaskBoard } from "@/lib/personal-task-board-setup";
import { serializePersonalBoardForClient } from "@/lib/personal-board-client";
import {
  canAssignPersonalTasks,
  canEditPersonalTask,
  canViewPersonalTask,
  canViewPersonalTasks,
} from "@/lib/personal-tasks-access";
import type { ClientBoard } from "./task-kanban-types";
import { persistTaskAttachmentFile } from "@/lib/task-attachment-upload";

const PATH = "/my-tasks";

async function sessionViewer() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true, headedDept: { select: { id: true } } },
  });
}

async function requireOwner(ownerUserId: string) {
  const v = await sessionViewer();
  if (!v || v.id !== ownerUserId) return null;
  return v;
}

async function viewerCanComment(viewerId: string, viewerRole: Role, headedDeptId: string | null, taskId: string) {
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
  return canViewPersonalTask({
    viewerUserId: viewerId,
    viewerRole,
    ownerUserId: t.board.ownerUserId,
    ownerManagerId: t.board.owner.managerId,
    ownerDepartmentId: t.board.owner.departmentId,
    viewerHeadedDepartmentId: headedDeptId,
    assignedByUserId: t.assignedByUserId,
  });
}

async function getTaskAccess(taskId: string, viewerId: string, viewerRole: Role, headedDeptId: string | null) {
  const task = await prisma.personalTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      boardId: true,
      stageId: true,
      assignedToUserId: true,
      assignedByUserId: true,
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

  const canEdit = canEditPersonalTask({
    viewerUserId: viewerId,
    ownerUserId: task.board.ownerUserId,
    assignedByUserId: task.assignedByUserId,
  });

  const canView = canViewPersonalTask({
    viewerUserId: viewerId,
    viewerRole,
    ownerUserId: task.board.ownerUserId,
    ownerManagerId: task.board.owner.managerId,
    ownerDepartmentId: task.board.owner.departmentId,
    viewerHeadedDepartmentId: headedDeptId,
    assignedByUserId: task.assignedByUserId,
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
    ownerUserId: owner.id,
    ownerManagerId: owner.managerId,
    ownerDepartmentId: owner.departmentId,
    viewerHeadedDepartmentId: v.headedDept?.id ?? null,
  });
  const canTrackAssignedTasks = canAssignPersonalTasks({
    viewerUserId: v.id,
    viewerStatus: v.status,
    assigneeUserId: owner.id,
    assigneeStatus: owner.status,
  });
  if (!okView && !canTrackAssignedTasks) return { ok: false, error: "You can’t view this board." };

  const boardPayload = await getOrCreatePersonalTaskBoard(peerUserId);
  const visibleBoard = okView
    ? boardPayload
    : {
        ...boardPayload,
        tasks: boardPayload.tasks.filter((task) => task.assignedByUserId === v.id),
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
  return { ok: true, userId: assignee.id, taskId: created.id };
}

export async function updateBoardTaskStage(taskId: string, stageId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false as const, error: "Unauthorized" };

  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const, error: "No access." };

  const targetStage = await prisma.personalTaskStage.findFirst({
    where: { id: stageId, board: { ownerUserId: access.task.assignedToUserId } },
    select: { id: true },
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
  return { ok: true as const };
}

export async function persistBoardLayout(ownerUserId: string, layout: Record<string, string[]>) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false as const };

  const board = await prisma.personalTaskBoard.findUnique({
    where: { ownerUserId },
    select: {
      id: true,
      stages: { select: { id: true } },
      tasks: { select: { id: true } },
    },
  });
  if (!board) return { ok: false as const };

  const stageIds = new Set(board.stages.map((s) => s.id));
  const taskIdsValid = new Set(board.tasks.map((t) => t.id));

  const assignments: { taskId: string; stageId: string; sortOrder: number }[] = [];
  const seen = new Set<string>();

  for (const [stageId, ids] of Object.entries(layout)) {
    if (!stageIds.has(stageId)) continue;
    ids.forEach((taskId, i) => {
      if (!taskIdsValid.has(taskId)) return;
      if (seen.has(taskId)) return;
      seen.add(taskId);
      assignments.push({ taskId, stageId, sortOrder: i });
    });
  }

  if (seen.size !== taskIdsValid.size) return { ok: false as const };

  await prisma.$transaction(
    assignments.map((a) =>
      prisma.personalTask.updateMany({
        where: { id: a.taskId, boardId: board.id },
        data: { stageId: a.stageId, sortOrder: a.sortOrder },
      }),
    ),
  );

  revalidateTasks();
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
    },
  };
}

export async function deleteBoardTask(ownerUserId: string, taskId: string) {
  const viewer = await sessionViewer();
  if (!viewer) return;
  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return;
  await prisma.personalTask.delete({ where: { id: taskId } });
  revalidateTasks();
}

export async function updateBoardTaskDetails(ownerUserId: string, taskId: string, formData: FormData) {
  const viewer = await sessionViewer();
  if (!viewer) return;
  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.headedDept?.id ?? null);
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

  const ok = await viewerCanComment(v.id, v.role as Role, v.headedDept?.id ?? null, taskId);
  if (!ok) return { ok: false as const, error: "No access." };

  await prisma.personalTaskComment.create({
    data: { taskId, authorId: v.id, body: bodyRaw },
  });
  revalidateTasks();
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

export async function addPersonalTaskAttachment(
  ownerUserId: string,
  taskId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const viewer = await sessionViewer();
  if (!viewer) return { ok: false, error: "Unauthorized" };

  const access = await getTaskAccess(taskId, viewer.id, viewer.role as Role, viewer.headedDept?.id ?? null);
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

  const access = await getTaskAccess(attachment.taskId, viewer.id, viewer.role as Role, viewer.headedDept?.id ?? null);
  if (!access?.canEdit) return { ok: false as const };

  await prisma.personalTaskAttachment.delete({ where: { id: attachmentId } });
  revalidateTasks();
  return { ok: true as const };
}
