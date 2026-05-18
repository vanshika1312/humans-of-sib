"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationCentreModal({
  open,
  onOpenChange,
  tab,
  unreadCount,
  notifications,
  loading,
  error,
  onTabChange,
  onMarkAllRead,
  onMarkRead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: "all" | "unread";
  unreadCount: number;
  notifications: NotificationItem[];
  loading: boolean;
  error: string | null;
  onTabChange: (tab: "all" | "unread") => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
}) {
  const unreadLabel = useMemo(() => (unreadCount > 99 ? "99+" : String(Math.max(0, unreadCount))), [unreadCount]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const list = notifications ?? [];

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        aria-hidden
        className="absolute inset-0 bg-ink-900/25 backdrop-blur-md"
        onClick={() => onOpenChange(false)}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notification Centre"
        className="absolute left-1/2 top-16 w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl border border-white/30 bg-white/80 backdrop-blur-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/30">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-ink-800 leading-tight">Notification Centre</div>
            <div className="text-xs text-ink-500">
              {loading ? "Loading…" : unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {unreadCount > 0 && (
              <Button size="sm" variant="outline" onClick={onMarkAllRead}>
                Mark all read
              </Button>
            )}
            <button
              type="button"
              aria-label="Close"
              className="size-9 rounded-full inline-flex items-center justify-center hover:bg-white/60 text-ink-700"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-3 flex items-center gap-2 border-b border-white/30">
          <Button
            size="sm"
            variant={tab === "all" ? "primary" : "outline"}
            onClick={() => onTabChange("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={tab === "unread" ? "primary" : "outline"}
            onClick={() => onTabChange("unread")}
          >
            Unread
            {unreadCount > 0 && <span className="ml-1.5">({unreadLabel})</span>}
          </Button>
          {error && <div className="ml-auto text-xs text-red-600">{error}</div>}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {list.length === 0 && !loading ? (
            <div className="py-10 text-center text-sm text-ink-500">No notifications yet.</div>
          ) : (
            <div className="space-y-3">
              {list.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <div
                    key={n.id}
                    className={[
                      "rounded-2xl border px-4 py-3 shadow-sm bg-white/70",
                      isUnread ? "border-sky-200 bg-sky-50/40" : "border-ink-100",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold text-ink-800">{n.title}</div>
                          {isUnread && <Badge tone="sky">New</Badge>}
                          <Badge tone="ink">{String(n.kind).replaceAll("_", " ")}</Badge>
                          <span className="text-xs text-ink-500 ml-auto">{relativeTime(n.createdAt)}</span>
                        </div>
                        {n.body && <p className="text-sm text-ink-600 mt-1 whitespace-pre-wrap">{n.body}</p>}

                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                          {n.href && (
                            <Link href={n.href} onClick={() => onOpenChange(false)}>
                              <Button size="sm" variant="outline">
                                View
                              </Button>
                            </Link>
                          )}
                          {isUnread && (
                            <Button size="sm" variant="ghost" onClick={() => onMarkRead(n.id)}>
                              Mark read
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

