"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function ClusterFilter({
  clusters,
  paramKey = "cluster",
}: {
  clusters: string[];
  paramKey?: string;
}) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const current      = searchParams.get(paramKey) ?? "";

  function select(val: string) {
    const p = new URLSearchParams(searchParams.toString());
    val ? p.set(paramKey, val) : p.delete(paramKey);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => select("")}
        className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
          !current
            ? "bg-ink-700 text-white"
            : "bg-white border border-ink-200 text-ink-500 hover:bg-ink-50"
        }`}
      >
        All
      </button>
      {clusters.map((c) => (
        <button
          key={c}
          onClick={() => select(c)}
          className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
            current === c
              ? "bg-ink-700 text-white"
              : "bg-white border border-ink-200 text-ink-500 hover:bg-ink-50"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
