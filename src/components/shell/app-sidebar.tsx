"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_KEY = "hosib-main-sidebar-collapsed";

export function AppSidebar({ role }: { role: string }) {
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
        "hidden md:flex shrink-0 border-r border-ink-100 bg-white flex-col transition-[width] duration-200 ease-out overflow-hidden relative",
        collapsed ? "w-[4.25rem]" : "w-64",
      )}
    >
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <Sidebar role={role} collapsed={collapsed} />
      </div>
      <div className="p-2 border-t border-ink-100 shrink-0">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={toggle}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold uppercase tracking-wide text-ink-500 hover:bg-ink-50 hover:text-ink-700"
        >
          {collapsed ? (
            <ChevronRight className="size-4" aria-hidden />
          ) : (
            <>
              <ChevronLeft className="size-4" aria-hidden />
              <span>Collapse menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
