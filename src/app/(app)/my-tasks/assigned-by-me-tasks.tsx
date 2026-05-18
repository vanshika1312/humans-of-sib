"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { displayName } from "@/lib/user-display-name";
import { cn } from "@/lib/utils";
import { subscribeAssignedByMeRefresh } from "./my-tasks-events";

type AssignedByMeTask = {
  id: string;
  title: string;
  assignedTo: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    image: string | null;
    title: string | null;
  };
  stage: {
    title: string;
    isFinishedColumn: boolean;
  };
};

export function AssignedByMeTasks({ initialTasks }: { initialTasks: AssignedByMeTask[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskParam = searchParams.get("task");

  const [tasks, setTasks] = useState<AssignedByMeTask[]>(initialTasks);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [isNavigating, startTransition] = useTransition();

  const taskIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);

  const reload = useCallback(async () => {
    const res = await fetch("/api/my-tasks/assigned-by-me", { method: "GET", cache: "no-store" });
    if (!res.ok) return;
    const data: unknown = await res.json();
    if (!data || typeof data !== "object") return;
    const maybe = data as { ok?: boolean; tasks?: AssignedByMeTask[] };
    if (!maybe.ok || !Array.isArray(maybe.tasks)) return;
    setTasks(maybe.tasks);
  }, []);

  useEffect(() => subscribeAssignedByMeRefresh(() => void reload()), [reload]);

  useEffect(() => {
    if (!taskParam) return;
    if (taskIds.has(taskParam)) return;
    void reload();
  }, [reload, taskIds, taskParam]);

  if (tasks.length === 0) {
    return <p className="text-sm text-ink-500">You haven&apos;t assigned any tasks to teammates yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {tasks.map((task) => {
        const href = `/my-tasks?userId=${encodeURIComponent(task.assignedTo.id)}&task=${encodeURIComponent(task.id)}`;
        const showLoader = isNavigating && pendingTaskId === task.id;

        return (
          <Link
            key={task.id}
            href={href}
            aria-busy={showLoader}
            onClick={(e) => {
              // Preserve default browser link behaviors (new tab/window, context menu, etc.).
              if (e.button !== 0) return;
              if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;

              e.preventDefault();
              setPendingTaskId(task.id);
              startTransition(() => router.push(href));
            }}
            className={cn(
              "rounded-xl border bg-white px-4 py-3 shadow-sm transition hover:border-sky-300 hover:shadow-md",
              showLoader && "cursor-wait opacity-75",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-800">{task.title}</p>
                <p className="mt-1 text-sm text-ink-500">
                  Assigned to {displayName(task.assignedTo)}
                  {task.assignedTo.title ? ` · ${task.assignedTo.title}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {showLoader ? <Loader2 className="size-4 animate-spin text-sky-700" aria-hidden /> : null}
                <span
                  className={cn(
                    "rounded-full px-2 py-1 text-[11px] font-semibold",
                    task.stage.isFinishedColumn ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700",
                  )}
                >
                  {task.stage.title}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

