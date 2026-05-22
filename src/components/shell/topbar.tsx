"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  navRole,
  navPermissions,
  signOutAction,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  deptName?: string | null;
  cityName?: string | null;
  unreadNotifications?: number;
  navRole?: string;
  navPermissions?: string[];
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<"all" | "unread">("all");
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifData, setNotifData] = useState<{
    unreadCount: number;
    unreadMessageCount: number;
    notifications: NotificationItem[];
  } | null>(null);

  const pathname = usePathname();
  const showHomeGreeting = pathname === "/home";
  const firstName = (user.name ?? "").split(" ")[0] || "there";

  const refreshTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  async function loadNotifications(nextTab: "all" | "unread", opts?: { silent?: boolean }) {
    if (!opts?.silent) {
      setNotifLoading(true);
      setNotifError(null);
    }
    try {
      const res = await fetch(`/api/notifications?tab=${encodeURIComponent(nextTab)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load notifications");
      const json = (await res.json()) as {
        unreadCount: number;
        unreadMessageCount: number;
        notifications: NotificationItem[];
      };
      setNotifData(json);
    } catch (e) {
      if (!opts?.silent) setNotifError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (!opts?.silent) setNotifLoading(false);
    }
  }

  async function refreshUnreadCounts() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(`/api/notifications?tab=${encodeURIComponent("unread")}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as {
        unreadCount: number;
        unreadMessageCount: number;
      };
      setNotifData((prev) => ({
        unreadCount: json.unreadCount,
        unreadMessageCount: json.unreadMessageCount,
        notifications: prev?.notifications ?? [],
      }));
    } finally {
      inFlightRef.current = false;
    }
  }

  async function markAllNotificationsRead() {
    setNotifError(null);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark all read");
      const json = (await res.json()) as { ok: true; unreadCount: number; unreadMessageCount: number };
      setNotifData((prev) => (prev ? { ...prev, unreadCount: json.unreadCount, unreadMessageCount: json.unreadMessageCount } : prev));
      await loadNotifications(notifTab);
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function markNotificationRead(id: string) {
    setNotifError(null);
    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark read");
      const json = (await res.json()) as { ok: true; unreadCount: number; unreadMessageCount: number };
      setNotifData((prev) => (prev ? { ...prev, unreadCount: json.unreadCount, unreadMessageCount: json.unreadMessageCount } : prev));
      await loadNotifications(notifTab);
    } catch (e) {
      setNotifError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  // Prefer the live (client-fetched) unread count once available.
  // The server-provided `unreadNotifications` can be stale until a layout refresh.
  const unreadBadgeCount = useMemo(() => {
    const live = notifData?.unreadCount;
    return Math.max(0, (live ?? unreadNotifications ?? 0) || 0);
  }, [notifData?.unreadCount, unreadNotifications]);
  const unreadLabel = unreadBadgeCount > 99 ? "99+" : String(unreadBadgeCount);

  useEffect(() => {
    void refreshUnreadCounts();

    const pollMs = 10_000;
    refreshTimerRef.current = window.setInterval(() => void refreshUnreadCounts(), pollMs);

    const onFocus = () => void refreshUnreadCounts();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      if (refreshTimerRef.current) window.clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    // When the user opens the centre, treat it as "seen" so the badge clears.
    if ((notifData?.unreadCount ?? unreadBadgeCount) > 0) {
      void markAllNotificationsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen]);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-ink-100">
        <div className="h-14 px-4 md:px-6 flex items-center gap-4">
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

          {showHomeGreeting && (
            <div className="hidden md:flex items-center min-w-0 flex-1">
              <div className="truncate text-2xl font-bold text-ink-700 pl-2">
                {timeGreeting()}, {firstName}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto">
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
              aria-label={
                unreadBadgeCount > 0 ? `Notifications (${unreadBadgeCount} unread)` : "Notifications"
              }
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
              {unreadBadgeCount > 0 && (
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
        unreadCount={notifData?.unreadCount ?? 0}
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
          <Sidebar onNavigate={() => setOpen(false)} role={navRole} permissions={navPermissions} />
        </aside>
      </div>
    </>
  );
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}
