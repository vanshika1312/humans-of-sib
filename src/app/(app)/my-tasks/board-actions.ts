"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { getOrCreatePersonalTaskBoard } from "@/lib/personal-task-board-setup";
import { canViewPersonalTasks } from "@/lib/personal-tasks-access";
import { persistTaskAttachmentFile } from "@/lib/task-attachment-upload";

const PATH = "/my-tasks";

async function sessionViewer() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, headedDept: { select: { id: true } } },
  });
}

async function requireOwner(ownerUserId: string) {
  const v = await sessionViewer();
  if (!v || v.id !== ownerUserId) return null;
  return v;
}

async function viewerCanAccessBoard(
  viewerId: string,
  viewerRole: Role,
  headedDeptId: string | null,
  boardOwnerId: string,
) {
  if (viewerId === boardOwnerId) return true;
  const owner = await prisma.user.findUnique({
    where: { id: boardOwnerId },
    select: { id: true, managerId: true, departmentId: true },
  });
  if (!owner) return false;
  return canViewPersonalTasks({
    viewerUserId: viewerId,
    viewerRole,
    ownerUserId: owner.id,
    ownerManagerId: owner.managerId,
    ownerDepartmentId: owner.departmentId,
    viewerHeadedDepartmentId: headedDeptId,
  });
}

async function viewerCanComment(viewerId: string, viewerRole: Role, headedDeptId: string | null, taskId: string) {
  const t = await prisma.personalTask.findUnique({
    where: { id: taskId },
    select: { board: { select: { ownerUserId: true } } },
  });
  if (!t) return false;
  return viewerCanAccessBoard(viewerId, viewerRole, headedDeptId, t.board.ownerUserId);
}

function nu(s: unknown, max?: number): string {
  const t = typeof s === "string" ? s.trim() : "";
  if (!max) return t;
  return t.slice(0, max);
}

function revalidateTasks() {
  revalidatePath(PATH);
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

export async function addBoardTask(ownerUserId: string, stageId: string, formData: FormData) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return;
  const title = nu(formData.get("title"), 500);
  if (!title.length) return;

  const board = await prisma.personalTaskBoard.findFirst({
    where: { ownerUserId, stages: { some: { id: stageId } } },
    select: { id: true },
  });
  if (!board) return;

  const agg = await prisma.personalTask.aggregate({
    where: { stageId },
    _max: { sortOrder: true },
  });

  await prisma.personalTask.create({
    data: {
      boardId: board.id,
      stageId,
      title,
      sortOrder: (agg._max.sortOrder ?? 0) + 1,
    },
  });
  revalidateTasks();
}

export async function deleteBoardTask(ownerUserId: string, taskId: string) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return;
  await prisma.personalTask.deleteMany({
    where: { id: taskId, board: { ownerUserId } },
  });
  revalidateTasks();
}

export async function updateBoardTaskDetails(ownerUserId: string, taskId: string, formData: FormData) {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return;
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
    where: { id: taskId, board: { ownerUserId } },
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
    include: { task: { include: { board: { select: { ownerUserId: true } } } } },
  });
  if (!row) return { ok: false as const };

  if (row.authorId !== v.id && row.task.board.ownerUserId !== v.id) return { ok: false as const };

  await prisma.personalTaskComment.delete({ where: { id: commentId } });
  revalidateTasks();
  return { ok: true as const };
}

export async function addPersonalTaskAttachment(
  ownerUserId: string,
  taskId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false, error: "Unauthorized" };

  const task = await prisma.personalTask.findFirst({
    where: { id: taskId, board: { ownerUserId } },
    select: { id: true },
  });
  if (!task) return { ok: false, error: "Task not found." };

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
  const viewer = await requireOwner(ownerUserId);
  if (!viewer) return { ok: false as const };

  const n = await prisma.personalTaskAttachment.deleteMany({
    where: { id: attachmentId, task: { board: { ownerUserId } } },
  });
  if (n.count !== 1) return { ok: false as const };
  revalidateTasks();
  return { ok: true as const };
}
