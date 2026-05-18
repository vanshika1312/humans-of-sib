"use client";

import { useMemo, useState, useTransition } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MessageSquareText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { displayName } from "@/lib/user-display-name";
import { cn } from "@/lib/utils";
import { stageColumnShell, taskCardSurface } from "@/lib/personal-task-board-tint";
import {
  addBoardTask,
  deletePersonalTaskStage,
  persistBoardLayout,
  renamePersonalTaskStage,
  reorderPersonalTaskStages,
  setPersonalTaskStageFinishedFlag,
} from "./board-actions";
import type { ClientBoard, ClientBoardStage, ClientBoardTask } from "./task-kanban-types";
import { TaskDrawer } from "./task-drawer";

const DROP_PREFIX = "drop~";
/** Prefix for horizontal column sortables (must not match task cuid). */
const COL_PREFIX = "col:";

function cloneBuckets(b: Record<string, string[]>): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const k of Object.keys(b)) {
    o[k] = [...b[k]];
  }
  return o;
}

function bucketsFromBoard(board: ClientBoard): Record<string, string[]> {
  const stages = [...board.stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const map: Record<string, string[]> = {};
  stages.forEach((s) => {
    map[s.id] = board.tasks
      .filter((t) => t.stageId === s.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => t.id);
  });
  return map;
}

function findContainer(
  id: UniqueIdentifier,
  buckets: Record<string, string[]>,
  orderedStageIds: string[],
): string | undefined {
  const raw = String(id);
  if (raw.startsWith(COL_PREFIX)) return undefined;
  if (raw.startsWith(DROP_PREFIX)) return raw.slice(DROP_PREFIX.length);
  for (const sid of orderedStageIds) {
    if (buckets[sid]?.includes(raw)) return sid;
  }
  return undefined;
}

function SortableCard(props: {
  id: string;
  title: string;
  readOnly: boolean;
  attachCount: number;
  commentCount: number;
  metaLabel?: string | null;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("rounded-lg px-2 py-2 text-sm transition-shadow flex gap-2 items-start", taskCardSurface())}
    >
      {!props.readOnly && (
        <button
          type="button"
          className="touch-none shrink-0 p-1 text-slate-400 hover:text-sky-600 mt-px cursor-grab active:cursor-grabbing"
          aria-label="Drag card"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <button type="button" onClick={props.onOpen} className="flex-1 text-left min-w-0 group">
        <p className="text-slate-800 font-medium text-sm leading-snug group-hover:text-sky-700 transition-colors">
          {props.title}
        </p>
        {props.metaLabel ? <p className="mt-1 truncate text-[11px] text-slate-500">{props.metaLabel}</p> : null}
        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-0.5">
            <Paperclip className="size-3.5" /> {props.attachCount}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <MessageSquareText className="size-3.5" /> {props.commentCount}
          </span>
        </div>
      </button>
    </div>
  );
}

function StageHeader(props: {
  ownerUserId: string;
  readOnly: boolean;
  stage: ClientBoardStage;
  visualIndex: number;
  cardCount: number;
  columnHandle?: { attributes: DraggableAttributes; listeners: HTMLAttributes<HTMLButtonElement> | undefined };
}) {
  const { ownerUserId, readOnly, stage, visualIndex, cardCount, columnHandle } = props;
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(stage.title);

  return (
    <div className="shrink-0 border-b border-slate-300/70 pb-2 mb-2">
      <div className="flex items-start gap-1.5">
        {!readOnly && columnHandle && (
          <button
            type="button"
            className="touch-none shrink-0 p-1 text-slate-400 hover:text-slate-600 mt-0.5 cursor-grab active:cursor-grabbing rounded"
            aria-label="Drag column"
            title="Drag to reorder column"
            {...columnHandle.attributes}
            {...columnHandle.listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            {editing && !readOnly ? (
              <Input
                className="h-8 text-sm font-semibold flex-1 min-w-0"
                value={label}
                autoFocus
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => {
                  setEditing(false);
                  if (label.trim() && label !== stage.title) {
                    startTransition(async () => {
                      const r = await renamePersonalTaskStage(ownerUserId, stage.id, label.trim());
                      if (!r.ok) toast.error("Could not rename stage");
                    });
                  } else setLabel(stage.title);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            ) : (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => !readOnly && setEditing(true)}
                className={cn(
                  "text-left min-w-0 truncate text-sm font-semibold leading-tight",
                  readOnly ? "text-slate-700" : "text-slate-800 hover:text-sky-700",
                )}
                title={readOnly ? stage.title : "Click to rename"}
              >
                {stage.title}
              </button>
            )}
            <span
              className="shrink-0 rounded-full bg-slate-500/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600"
              aria-label={`${cardCount} cards`}
            >
              {cardCount}
            </span>
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                aria-label="Delete stage"
                onClick={() => {
                  if (!window.confirm(`Delete stage “${stage.title}”? It must be empty.`)) return;
                  startTransition(async () => {
                    const r = await deletePersonalTaskStage(ownerUserId, stage.id);
                    if (!r.ok) toast.error(r.error || "Could not delete");
                  });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
          {!readOnly && (
            <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
              <input
                type="checkbox"
                checked={stage.isFinishedColumn}
                onChange={(e) => {
                  startTransition(async () => {
                    const r = await setPersonalTaskStageFinishedFlag(ownerUserId, stage.id, e.target.checked);
                    if (!r.ok) toast.error("Could not update stage");
                  });
                }}
                className="rounded border-slate-400"
              />
              Counts as done on summaries
            </label>
          )}
        </div>
        <span className="sr-only">Column {visualIndex + 1}</span>
      </div>
    </div>
  );
}

function SortableStageColumn(props: {
  stage: ClientBoardStage;
  stageIndex: number;
  ownerUserId: string;
  readOnly: boolean;
  bucketIds: string[];
  taskById: Record<string, ClientBoardTask | undefined>;
  onOpenTask: (id: string) => void;
  onTaskAdded: (stageId: string, task: ClientBoardTask) => void;
  refreshBoard: () => void;
}) {
  const { stage, stageIndex, ownerUserId, readOnly, bucketIds, taskById, onOpenTask, onTaskAdded, refreshBoard } = props;
  const [addingTask, startAddTransition] = useTransition();

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({
    id: COL_PREFIX + stage.id,
    disabled: readOnly,
  });

  const { setNodeRef: setDroppableRef } = useDroppable({ id: DROP_PREFIX + stage.id });

  const columnStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isColumnDragging ? 0.55 : undefined,
  };

  return (
    <section
      ref={setSortableRef}
      style={columnStyle}
      className={cn(
        "flex w-[272px] shrink-0 flex-col rounded-lg px-2.5 pt-2.5 pb-2 shadow-sm",
        stageColumnShell(),
      )}
    >
      <StageHeader
        key={`${stage.id}:${stage.title}`}
        ownerUserId={ownerUserId}
        readOnly={readOnly}
        stage={stage}
        visualIndex={stageIndex}
        cardCount={bucketIds.length}
        columnHandle={readOnly ? undefined : { attributes, listeners: listeners as HTMLAttributes<HTMLButtonElement> | undefined }}
      />

      <div ref={setDroppableRef} className="flex min-h-0 flex-1 flex-col">
        <SortableContext id={`tasks-${stage.id}`} items={bucketIds} strategy={verticalListSortingStrategy}>
          <ul className="min-h-[120px] flex-1 space-y-2 overflow-y-auto overflow-x-hidden pb-1 pr-0.5 [max-height:min(68vh,640px)]">
            {bucketIds.map((tid) => {
              const t = taskById[tid];
              if (!t) return null;
              return (
                <li key={tid}>
                  <SortableCard
                    id={tid}
                    title={t.title}
                    readOnly={readOnly}
                    attachCount={t.attachments.length}
                    commentCount={t.comments.length}
                    metaLabel={
                      t.assignedTo.id === ownerUserId
                        ? t.assignedBy && t.assignedBy.id !== ownerUserId
                          ? `Assigned by ${displayName(t.assignedBy)}`
                          : null
                        : `Assigned to ${displayName(t.assignedTo)}`
                    }
                    onOpen={() => onOpenTask(tid)}
                  />
                </li>
              );
            })}
          </ul>
        </SortableContext>

        {!readOnly && (
          <form
            className="mt-2 flex shrink-0 gap-1 border-t border-slate-300/60 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              startAddTransition(async () => {
                const r = await addBoardTask(ownerUserId, stage.id, fd);
                if (r.ok && r.task) {
                  form.reset();
                  onTaskAdded(stage.id, r.task);
                  refreshBoard();
                  return;
                }
                toast.error("Could not add card.");
              });
            }}
          >
            <Label htmlFor={`add-${stage.id}`} className="sr-only mb-0">
              New card
            </Label>
            <Input
              id={`add-${stage.id}`}
              name="title"
              placeholder="Create issue"
              disabled={addingTask}
              className="h-8 flex-1 border-slate-300/80 bg-white text-sm placeholder:text-slate-400"
              maxLength={500}
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 text-xs font-medium"
              disabled={addingTask}
            >
              {addingTask ? "…" : "Add"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}

export function TaskKanbanBoard({
  board,
  ownerUserId,
  viewerId,
  readOnly,
  initialOpenTaskId,
  suppressUrlSync,
}: {
  board: ClientBoard;
  ownerUserId: string;
  viewerId: string;
  readOnly: boolean;
  initialOpenTaskId: string | null;
  /** Do not rewrite `/my-tasks` query params when selecting a card (nested overlay). */
  suppressUrlSync?: boolean;
}) {
  const router = useRouter();

  const orderedStages = useMemo(
    () => [...board.stages].sort((a, b) => a.sortOrder - b.sortOrder),
    [board.stages],
  );
  const stageOrderIds = useMemo(() => orderedStages.map((s) => s.id), [orderedStages]);
  const columnSortableIds = useMemo(() => stageOrderIds.map((id) => COL_PREFIX + id), [stageOrderIds]);

  /** Initialize buckets from the server payload; remounts handle resync after refreshes. */
  const [buckets, setBuckets] = useState(() => bucketsFromBoard(board));
  const [tasks, setTasks] = useState(board.tasks);

  const taskById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [openTaskId, setOpenTaskId] = useState(initialOpenTaskId);

  function syncUrl(taskId: string | null) {
    if (suppressUrlSync) return;
    const qs = new URLSearchParams();
    if (viewerId !== ownerUserId) qs.set("userId", ownerUserId);
    if (taskId) qs.set("task", taskId);
    const tail = qs.toString();
    if (viewerId !== ownerUserId) {
      router.replace(tail ? `/my-tasks?${tail}` : `/my-tasks?userId=${encodeURIComponent(ownerUserId)}`, { scroll: false });
      return;
    }
    router.replace(tail ? `/my-tasks?${tail}` : "/my-tasks", { scroll: false });
  }

  function handleDragStart(e: DragStartEvent) {
    if (readOnly) return;
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const activeRaw = String(active.id);

    if (readOnly) {
      setActiveId(null);
      return;
    }

    const clearOverlay = () => setActiveId(null);

    /** Column reorder */
    if (activeRaw.startsWith(COL_PREFIX)) {
      clearOverlay();
      if (!over) return;
      const overRaw = String(over.id);
      const fromStageId = activeRaw.slice(COL_PREFIX.length);

      let toStageId: string | undefined;
      if (overRaw.startsWith(COL_PREFIX)) {
        toStageId = overRaw.slice(COL_PREFIX.length);
      } else return;

      if (!toStageId || fromStageId === toStageId) return;

      const oldIndex = stageOrderIds.indexOf(fromStageId);
      const newIndex = stageOrderIds.indexOf(toStageId);
      if (oldIndex < 0 || newIndex < 0) return;

      const nextOrder = arrayMove([...stageOrderIds], oldIndex, newIndex);
      startTransition(async () => {
        const r = await reorderPersonalTaskStages(ownerUserId, nextOrder);
        if (!r.ok) {
          toast.error("Could not reorder columns.");
          return;
        }
        router.refresh();
      });
      return;
    }

    /** Task move / reorder */
    if (!over) {
      clearOverlay();
      return;
    }

    const activeIdRaw = activeRaw;
    const overIdRaw = String(over.id);
    const nextBuckets = cloneBuckets(buckets);

    const activeContainer = findContainer(activeIdRaw, nextBuckets, stageOrderIds);
    if (!activeContainer) {
      clearOverlay();
      return;
    }

    let overContainer: string | undefined;
    let overItemId: string | undefined;

    if (overIdRaw.startsWith(DROP_PREFIX)) {
      overContainer = overIdRaw.slice(DROP_PREFIX.length);
    } else if (overIdRaw.startsWith(COL_PREFIX)) {
      overContainer = overIdRaw.slice(COL_PREFIX.length);
    } else if (stageOrderIds.includes(overIdRaw)) {
      overContainer = overIdRaw;
    } else {
      overContainer = findContainer(overIdRaw, nextBuckets, stageOrderIds);
      overItemId = overIdRaw;
    }

    if (!overContainer || nextBuckets[activeContainer] === undefined || nextBuckets[overContainer] === undefined) {
      clearOverlay();
      return;
    }

    /** Dropping onto column chrome or empty bucket = append */
    let resolvedOverItem = overItemId;
    if (overIdRaw.startsWith(DROP_PREFIX) || overIdRaw.startsWith(COL_PREFIX)) {
      resolvedOverItem = undefined;
    } else if (stageOrderIds.includes(overIdRaw)) {
      resolvedOverItem = undefined;
    } else if (resolvedOverItem && !nextBuckets[overContainer]?.includes(resolvedOverItem)) {
      resolvedOverItem = undefined;
    }

    const activeIdx = nextBuckets[activeContainer].indexOf(activeIdRaw);
    if (activeIdx === -1) {
      clearOverlay();
      return;
    }

    if (activeContainer === overContainer) {
      let overIdx: number;
      if (overIdRaw.startsWith(DROP_PREFIX)) {
        overIdx = Math.max(0, nextBuckets[overContainer].length - 1);
      } else if (resolvedOverItem) {
        overIdx = nextBuckets[overContainer].indexOf(resolvedOverItem);
      } else {
        overIdx = nextBuckets[overContainer].length - 1;
      }
      if (overIdx < 0) overIdx = nextBuckets[overContainer].length;
      nextBuckets[activeContainer] = arrayMove(nextBuckets[activeContainer], activeIdx, overIdx);
    } else {
      nextBuckets[activeContainer] = nextBuckets[activeContainer].filter((id) => id !== activeIdRaw);
      let overIdx =
        resolvedOverItem && nextBuckets[overContainer].includes(resolvedOverItem)
          ? nextBuckets[overContainer].indexOf(resolvedOverItem)
          : nextBuckets[overContainer].length;
      if (overIdx < 0) overIdx = nextBuckets[overContainer].length;
      nextBuckets[overContainer] = [
        ...nextBuckets[overContainer].slice(0, overIdx),
        activeIdRaw,
        ...nextBuckets[overContainer].slice(overIdx),
      ];
    }

    const snapshotRollback = bucketsFromBoard(board);
    setBuckets(nextBuckets);
    startTransition(async () => {
      const pers = await persistBoardLayout(ownerUserId, nextBuckets);
      if (!pers.ok) {
        toast.error("Could not save card order.");
        setBuckets(snapshotRollback);
      }
    });
    clearOverlay();
  }

  const drawerTask = openTaskId ? taskById[openTaskId] ?? null : null;

  const draggedColumnStage = activeId?.startsWith(COL_PREFIX)
    ? orderedStages.find((s) => COL_PREFIX + s.id === activeId)
    : undefined;

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full rounded-xl bg-slate-200/50 p-3 ring-1 ring-slate-200/80">
          <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            <div className="flex min-w-fit items-start gap-3">
              <SortableContext items={columnSortableIds} strategy={horizontalListSortingStrategy}>
                {orderedStages.map((stage, idx) => (
                  <SortableStageColumn
                    key={stage.id}
                    stage={stage}
                    stageIndex={idx}
                    ownerUserId={ownerUserId}
                    readOnly={readOnly}
                    bucketIds={buckets[stage.id] ?? []}
                    taskById={taskById}
                    onOpenTask={(tid) => {
                      setOpenTaskId(tid);
                      syncUrl(tid);
                    }}
                    onTaskAdded={(stageId, task) => {
                      setTasks((current) => [...current, task]);
                      setBuckets((current) => ({
                        ...current,
                        [stageId]: [...(current[stageId] ?? []), task.id],
                      }));
                    }}
                    refreshBoard={() => router.refresh()}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
          {activeId?.startsWith(COL_PREFIX) && draggedColumnStage ? (
            <div
              className={cn(
                "w-[268px] rounded-lg px-3 py-3 shadow-lg ring-2 ring-slate-400/30",
                stageColumnShell(),
              )}
            >
              <div className="flex items-center gap-2 border-b border-slate-300/70 pb-2">
                <GripVertical className="size-4 shrink-0 text-slate-500" />
                <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{draggedColumnStage.title}</p>
              </div>
              <div className="mt-3 h-24 rounded-md border border-dashed border-slate-300/70 bg-white/60" />
            </div>
          ) : activeId && taskById[activeId] ? (
            <div
              className={cn(
                "max-w-[260px] rounded-lg px-3 py-2 text-sm font-medium shadow-lg ring-1 ring-slate-300/70",
                taskCardSurface(),
              )}
            >
              {taskById[activeId]?.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {drawerTask && (
        <TaskDrawer
          key={drawerTask.id}
          task={drawerTask}
          stages={orderedStages}
          ownerUserId={ownerUserId}
          viewerId={viewerId}
          readOnlyBoard={readOnly}
          onClose={() => {
            setOpenTaskId(null);
            syncUrl(null);
          }}
        />
      )}
    </div>
  );
}
