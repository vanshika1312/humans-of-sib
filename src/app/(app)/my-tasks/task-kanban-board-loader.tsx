"use client";

import dynamic from "next/dynamic";
import type { ClientBoard } from "./task-kanban-types";

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
  /** When true, opening a task does not change the URL (e.g. team overlay). */
  suppressUrlSync?: boolean;
};

export function TaskKanbanBoardLoader(props: TaskKanbanBoardLoaderProps) {
  return <TaskKanbanBoard {...props} />;
}
