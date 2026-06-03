"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "hosib-main-sidebar-collapsed";

export function AppSidebar({
  role,
  permissions,
  liaEnabled,
}: {
  role: string;
  permissions: string[];
  liaEnabled?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        "hidden md:flex shrink-0 border-r border-ink-100 bg-white flex-col transition-[width] duration-200 ease-out overflow-hidden relative sticky top-0 h-screen z-20",
        collapsed ? "w-[4.25rem]" : "w-64",
      )}
    >
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        <Sidebar
          role={role}
          permissions={permissions}
          collapsed={collapsed}
          onToggleCollapsed={toggle}
          liaEnabled={liaEnabled}
        />
      </div>
    </aside>
  );
}
