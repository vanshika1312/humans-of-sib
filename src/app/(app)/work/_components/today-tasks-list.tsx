"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatQuantityLabel } from "@/lib/work-tracking/config";
import type { ClientDailyWorkTask } from "../actions";
import { loadDailyWorkTaskForClient } from "../actions";
import { DailyTaskDrawer } from "./daily-task-drawer";

const PRIORITY_TONE: Record<string, "red" | "orange" | "ink"> = {
  P1: "red",
  P2: "orange",
  P3: "ink",
};

const EOD_STATUS_TONE: Record<string, "green" | "orange" | "red" | "sky"> = {
  COMPLETED: "green",
  PARTIAL: "orange",
  NOT_STARTED: "red",
};

export type TodayTaskListItem = {
  id: string;
  projectName: string;
  priority: string;
  taskTypeName: string;
  eodStatus: string | null;
  targetQuantity: number;
  quantityUnit: string;
  dueByTime: string | null;
  keyResultTitle: string | null;
  actualQuantity: number | null;
  attachmentCount: number;
};

export function TodayTasksList({
  tasks,
  dateParam,
  initialOpenTaskId,
}: {
  tasks: TodayTaskListItem[];
  dateParam: string;
  initialOpenTaskId: string | null;
}) {
  const router = useRouter();
  const [openTaskId, setOpenTaskId] = useState<string | null>(initialOpenTaskId);
  const [drawerTask, setDrawerTask] = useState<ClientDailyWorkTask | null>(null);

  const syncUrl = useCallback(
    (taskId: string | null) => {
      const qs = new URLSearchParams();
      qs.set("date", dateParam);
      qs.set("tab", "today");
      if (taskId) qs.set("task", taskId);
      router.replace(`/work?${qs.toString()}`, { scroll: false });
    },
    [dateParam, router],
  );

  const openTask = useCallback(
    (taskId: string) => {
      setOpenTaskId(taskId);
      syncUrl(taskId);
    },
    [syncUrl],
  );

  const closeDrawer = useCallback(() => {
    setOpenTaskId(null);
    setDrawerTask(null);
    syncUrl(null);
  }, [syncUrl]);

  useEffect(() => {
    if (!openTaskId) {
      setDrawerTask(null);
      return;
    }
    if (drawerTask?.id === openTaskId) return;

    let cancelled = false;
    void loadDailyWorkTaskForClient(openTaskId).then((r) => {
      if (cancelled) return;
      if (r.ok) setDrawerTask(r.task);
      else {
        setOpenTaskId(null);
        setDrawerTask(null);
        syncUrl(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [openTaskId, drawerTask?.id, syncUrl]);

  useEffect(() => {
    setOpenTaskId(initialOpenTaskId);
  }, [initialOpenTaskId]);

  return (
    <>
      <div className="grid gap-3">
        {tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => openTask(t.id)}
            className={cn(
              "text-left rounded-xl border bg-white shadow-sm transition hover:border-sky-300 hover:shadow-md",
              openTaskId === t.id && "border-sky-300 ring-1 ring-sky-200",
            )}
          >
            <Card className="border-0 shadow-none">
              <CardContent className="pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={PRIORITY_TONE[t.priority] ?? "ink"}>{t.priority}</Badge>
                      <Badge tone="sky">{t.taskTypeName}</Badge>
                      {t.eodStatus && (
                        <Badge tone={EOD_STATUS_TONE[t.eodStatus] ?? "ink"}>
                          {t.eodStatus.replace("_", " ")}
                        </Badge>
                      )}
                      {t.attachmentCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-ink-500">
                          <Paperclip className="size-3" aria-hidden />
                          {t.attachmentCount}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold text-ink-700">{t.projectName}</h3>
                    <p className="text-sm text-ink-500 mt-1">
                      Target: {formatQuantityLabel(t.targetQuantity, t.quantityUnit)}
                      {t.dueByTime ? ` · Due by ${t.dueByTime}` : ""}
                      {t.keyResultTitle ? ` · KR: ${t.keyResultTitle}` : ""}
                    </p>
                  </div>
                  {t.eodStatus && t.eodStatus !== "NOT_STARTED" && (
                    <div className="text-right text-sm text-emerald-700">
                      Delivered: {formatQuantityLabel(t.actualQuantity ?? 0, t.quantityUnit)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {drawerTask && openTaskId === drawerTask.id && (
        <DailyTaskDrawer
          key={drawerTask.id}
          task={drawerTask}
          onTaskChanged={setDrawerTask}
          onClose={closeDrawer}
        />
      )}
    </>
  );
}
