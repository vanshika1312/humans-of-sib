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
    tasks: board.tasks.map((t) => ({
      id: t.id,
      stageId: t.stageId,
      title: t.title,
      description: t.description,
      sortOrder: t.sortOrder,
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
    })),
  };
}
