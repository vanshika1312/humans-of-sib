import type { PersonalBoardPayload } from "@/lib/personal-task-board-setup";
import type { ClientBoard } from "@/app/(app)/my-tasks/task-kanban-types";

/** Server-safe JSON-safe board shape for the client Kanban. */
export function serializePersonalBoardForClient(board: PersonalBoardPayload): ClientBoard {
  return {
    id: board.id,
    updatedAtMs: board.updatedAt.getTime(),
    stages: board.stages.map((s) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sortOrder,
      isFinishedColumn: s.isFinishedColumn,
    })),
    labels: board.labels.map((l) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      sortOrder: l.sortOrder,
    })),
    tasks: board.tasks.map((t) => ({
      id: t.id,
      stageId: t.stageId,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      sortOrder: t.sortOrder,
      assignmentGroupId: t.assignmentGroupId ?? null,
      assignedTo: {
        id: t.assignedTo.id,
        name: t.assignedTo.name,
        firstName: t.assignedTo.firstName,
        lastName: t.assignedTo.lastName,
        email: t.assignedTo.email,
        image: t.assignedTo.image,
      },
      assignedBy: t.assignedBy
        ? {
            id: t.assignedBy.id,
            name: t.assignedBy.name,
            firstName: t.assignedBy.firstName,
            lastName: t.assignedBy.lastName,
            email: t.assignedBy.email,
            image: t.assignedBy.image,
          }
        : null,
      attachments: t.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        url: a.url,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
      comments: t.comments.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        author: {
          id: c.author.id,
          name: c.author.name,
          firstName: c.author.firstName,
          lastName: c.author.lastName,
          email: c.author.email,
          image: c.author.image,
        },
      })),
      members: t.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        image: m.user.image,
      })),
      labels: t.labelAssignments
        .map((a) => a.label)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l) => ({ id: l.id, name: l.name, color: l.color })),
      checklists: t.checklists.map((c) => ({
        id: c.id,
        title: c.title,
        items: c.items.map((it) => ({ id: it.id, body: it.body, isDone: it.isDone, sortOrder: it.sortOrder })),
      })),
    })),
  };
}
