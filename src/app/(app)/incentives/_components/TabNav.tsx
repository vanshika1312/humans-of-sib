"use client";

import { useRouter, usePathname } from "next/navigation";

type Tab = { id: string; label: string };

export function TabNav({ tabs, active }: { tabs: Tab[]; active: string }) {
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex bg-white border border-ink-100 rounded-lg p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => router.push(`${pathname}?tab=${t.id}`)}
          className={`px-5 py-2 rounded-md text-sm font-medium transition-colors ${
            active === t.id
              ? "bg-ink-700 text-white"
              : "text-ink-500 hover:text-ink-700 hover:bg-ink-50"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
