"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { displayName } from "@/lib/user-display-name";
import { cn } from "@/lib/utils";
import { loadPersonalTaskBoardForModal } from "./board-actions";
import { TaskKanbanBoardLoader } from "./task-kanban-board-loader";
import type { ClientBoard } from "./task-kanban-types";

export type TeamMemberForTasks = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  image: string | null;
  title: string | null;
};

export function TeamTaskMemberCards({
  members,
  openCounts,
  viewerId,
  peekMember,
  initialOverlay,
}: {
  members: TeamMemberForTasks[];
  openCounts: Record<string, number>;
  viewerId: string;
  /** Resolved profile when opening overlay from `/my-tasks?userId=` (may be outside the visible team grid). */
  peekMember: TeamMemberForTasks | null;
  /** When present (e.g. `/my-tasks?userId=`), open overlay on mount with this board already loaded */
  initialOverlay: { userId: string; board: ClientBoard } | null;
}) {
  const router = useRouter();
  const [overlayUserId, setOverlayUserId] = useState<string | null>(() => initialOverlay?.userId ?? null);
  const [overlayBoard, setOverlayBoard] = useState<ClientBoard | null>(() => initialOverlay?.board ?? null);
  const [loadingOverlay, startTransition] = useTransition();

  const selected =
    overlayUserId != null ? members.find((m) => m.id === overlayUserId) ?? (peekMember?.id === overlayUserId ? peekMember : null) : null;

  /** Strip legacy `userId` from URL after hydrating an overlay-from-link (keeps other params). */
  useEffect(() => {
    if (!initialOverlay?.userId) return;
    const qs = new URLSearchParams(window.location.search);
    if (!qs.has("userId")) return;
    qs.delete("userId");
    const tail = qs.toString();
    router.replace(tail ? `/my-tasks?${tail}` : "/my-tasks", { scroll: false });
  }, [router, initialOverlay?.userId]);

  function closeOverlay() {
    setOverlayUserId(null);
    setOverlayBoard(null);
  }

  function openOverlay(userId: string) {
    if (userId === viewerId) return;
    setOverlayUserId(userId);
    setOverlayBoard(null);
    startTransition(async () => {
      const r = await loadPersonalTaskBoardForModal(userId);
      if (!r.ok) {
        toast.error(r.error);
        setOverlayUserId(null);
        return;
      }
      setOverlayBoard(r.board);
    });
  }

  useEffect(() => {
    if (!overlayUserId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [overlayUserId]);

  if (members.length === 0 && !initialOverlay) return null;

  const memberLabel =
    selected && (
      <>
        <h2 id="team-board-overlay-title" className="truncate text-base font-semibold text-ink-800">
          {displayName(selected)}
        </h2>
        <p className="text-xs text-ink-500">{selected.title || "Team member"}</p>
      </>
    );

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((u) => {
          const dn = displayName(u);
          const open = openCounts[u.id] ?? 0;
          const isHighlighted = overlayUserId === u.id;

          return (
            <button
              key={u.id}
              type="button"
              onClick={() => openOverlay(u.id)}
              className={cn(
                "group flex w-full cursor-pointer items-center gap-3 rounded-xl border bg-white px-4 py-3.5 text-left shadow-sm transition-all hairline hover:border-sky-300 hover:shadow-md",
                isHighlighted && "border-sky-200 shadow-md ring-2 ring-sky-400",
                loadingOverlay && overlayUserId === u.id && !overlayBoard && "opacity-75",
              )}
            >
              <Avatar src={u.image} name={dn} size="lg" className="ring-ink-100 group-hover:ring-sky-100" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink-800 transition-colors group-hover:text-sky-700">
                  {dn}
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-500">{u.title || "Team member"}</div>
                <div className="mt-1 text-[11px] text-ink-400">
                  {open === 0 ? "No active tasks on board" : `${open} active on board`}
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-ink-300 transition-colors group-hover:text-sky-500" aria-hidden />
            </button>
          );
        })}
      </div>

      {overlayUserId ? (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 min-h-[100dvh] cursor-default bg-black/40 backdrop-blur-md"
            aria-label="Close backdrop"
            onClick={closeOverlay}
          />

          <div
            role="dialog"
            aria-labelledby={selected ? "team-board-overlay-title" : undefined}
            aria-busy={!overlayBoard}
            aria-modal="true"
            className={cn(
              "relative z-10 mx-auto mt-[max(1.25rem,min(10vh,4rem))] flex max-h-[min(88vh,920px)] w-[min(96vw,1280px)] flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-2xl outline-none md:rounded-2xl",
            )}
          >
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-slate-50/95 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {selected ? (
                  <>
                    <Avatar src={selected.image} name={displayName(selected)} size="lg" className="shrink-0 ring-ink-100" />
                    <div className="min-w-0">{memberLabel}</div>
                  </>
                ) : (
                  <p className="text-sm font-medium text-ink-600">Board</p>
                )}
              </div>
              <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-2" onClick={closeOverlay}>
                <span className="hidden sm:inline">Close</span>
                <X className="size-5" aria-hidden />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100/80 px-4 py-4">
              {overlayBoard ? (
                <TaskKanbanBoardLoader
                  board={overlayBoard}
                  ownerUserId={overlayUserId}
                  viewerId={viewerId}
                  readOnly
                  initialOpenTaskId={null}
                  suppressUrlSync
                />
              ) : (
                <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-white/60">
                  <p className="text-sm text-ink-500">{loadingOverlay ? "Loading board…" : "Loading board…"}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
