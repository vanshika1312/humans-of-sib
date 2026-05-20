"use client";

import dynamic from "next/dynamic";
import type { ClientBoard } from "./task-kanban-types";
import type { ClientTaskAssignee } from "./task-kanban-types";

const TaskKanbanBoard = dynamic(
  () => import("./task-kanban").then((m) => ({ default: m.TaskKanbanBoard })),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-[220px] w-full animate-pulse rounded-xl bg-slate-200/50 p-3 ring-1 ring-slate-200/80"
        aria-busy
        aria-label="Loading board"
      />
    ),
  },
);

export type TaskKanbanBoardLoaderProps = {
  board: ClientBoard;
  ownerUserId: string;
  viewerId: string;
  readOnly: boolean;
  initialOpenTaskId: string | null;
  memberOptions: ClientTaskAssignee[];
  /** When true, opening a task does not change the URL (e.g. team overlay). */
  suppressUrlSync?: boolean;
};

export function TaskKanbanBoardLoader(props: TaskKanbanBoardLoaderProps) {
  const boardKey = [
    props.board.id,
    props.board.updatedAtMs,
    props.initialOpenTaskId ?? "",
    props.board.stages
      .map((stage) => `${stage.id}:${stage.sortOrder}:${stage.title}:${stage.isFinishedColumn ? 1 : 0}`)
      .join("|"),
    props.board.labels.map((l) => `${l.id}:${l.sortOrder}:${l.name}:${l.color}`).join("|"),
    props.board.tasks
      .map(
        (task) => {
          const checklistTotal = task.checklists.reduce((n, c) => n + c.items.length, 0);
          const checklistDone = task.checklists.reduce((n, c) => n + c.items.filter((it) => it.isDone).length, 0);
          return [
            task.id,
            task.stageId,
            task.sortOrder,
            task.title,
            task.assignedTo.id,
            task.assignedBy?.id ?? "",
            task.dueDate ?? "",
            task.attachments.length,
            task.comments.length,
            task.members.length,
            task.labels.map((l) => l.id).join(","),
            checklistDone,
            checklistTotal,
          ].join(":");
        },
      )
      .join("|"),
  ].join("~");

  return <TaskKanbanBoard key={boardKey} {...props} />;
}
