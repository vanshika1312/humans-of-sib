"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import { NotificationCentreModal, type NotificationItem } from "@/components/notifications/notification-centre-modal";

export function Topbar({
  user,
  deptName,
  cityName,
  unreadNotifications = 0,
  signOutAction,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  deptName?: string | null;
  cityName?: string | null;
  unreadNotifications?: number;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<"all" | "unread">("all");
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifData, setNotifData] = useState<{ unreadCount: number; notifications: NotificationItem[] } | null>(null);

  async function loadNotifications(nextTab: "all" | "unread") {
    setNotifLoading(true);
    setNotifError(null);
    try {
      const res = await fetch(`/api/notifications?tab=${encodeURIComponent(nextTab)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load notifications");
      const json = (await res.json()) as { unreadCount: number; notifications: NotificationItem[] };
      setNotifData(json);
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setNotifLoading(false);
    }
  }

  async function markAllNotificationsRead() {
    setNotifError(null);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      if (!res.ok) throw new Error("Failed to mark all read");
      await loadNotifications(notifTab);
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function markNotificationRead(id: string) {
    setNotifError(null);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id }),
      });
      if (!res.ok) throw new Error("Failed to mark read");
      await loadNotifications(notifTab);
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const unread = Math.max(0, Math.max(unreadNotifications || 0, notifData?.unreadCount ?? 0));
  const unreadLabel = unread > 99 ? "99+" : String(unread);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-ink-100">
        <div className="h-14 px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open menu"
              onClick={() => setOpen(true)}
              className="md:hidden size-9 inline-flex items-center justify-center rounded-md hover:bg-ink-100"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-2 md:hidden">
              <div className="size-7 rounded-md brand-gradient" />
              <span className="font-bold text-ink-700 text-sm">Humans of SIB</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-ink-400">
              {deptName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-100 text-ink-600">
                  {deptName}
                </span>
              )}
              {cityName && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink-100 text-ink-600">
                  📍 {cityName}
                </span>
              )}
            </div>

            <button
              type="button"
              aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
              aria-haspopup="dialog"
              aria-expanded={notifOpen}
              onClick={() => {
                setMenuOpen(false);
                setNotifTab("all");
                setNotifOpen(true);
                void loadNotifications("all");
              }}
              className="relative size-9 inline-flex items-center justify-center rounded-md hover:bg-ink-100 text-ink-600"
            >
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold inline-flex items-center justify-center">
                  {unreadLabel}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-ink-100"
              >
                <Avatar src={user.image} name={user.name} size="sm" />
                <span className="hidden sm:block text-sm font-medium text-ink-600 pr-2">
                  {user.name?.split(" ")[0] || "You"}
                </span>
              </button>

              {menuOpen && (
                <>
                  <button
                    aria-hidden
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-lg border border-ink-100 shadow-lg z-30 overflow-hidden">
                    <div className="px-4 py-3 border-b border-ink-100">
                      <div className="text-sm font-semibold text-ink-700">{user.name}</div>
                      <div className="text-xs text-ink-400 truncate">{user.email}</div>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/me"
                        className="block px-4 py-2 text-sm text-ink-600 hover:bg-ink-50"
                        onClick={() => setMenuOpen(false)}
                      >
                        My profile
                      </Link>
                      <form action={signOutAction}>
                        <button
                          type="submit"
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <LogOut className="size-4" />
                          Sign out
                        </button>
                      </form>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <NotificationCentreModal
        open={notifOpen}
        onOpenChange={setNotifOpen}
        tab={notifTab}
        loading={notifLoading}
        error={notifError}
        unreadCount={notifData?.unreadCount ?? unread}
        notifications={notifData?.notifications ?? []}
        onTabChange={(t) => {
          setNotifTab(t);
          void loadNotifications(t);
        }}
        onMarkAllRead={() => void markAllNotificationsRead()}
        onMarkRead={(id) => void markNotificationRead(id)}
      />

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-opacity",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      >
        <button
          aria-hidden
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-ink-700/40"
        />
        <aside className={cn(
          "absolute left-0 top-0 bottom-0 w-72 bg-white shadow-xl transition-transform",
          open ? "translate-x-0" : "-translate-x-full",
        )}>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 size-8 inline-flex items-center justify-center rounded-md hover:bg-ink-100"
          >
            <X className="size-5" />
          </button>
          <Sidebar onNavigate={() => setOpen(false)} />
        </aside>
      </div>
    </>
  );
}
