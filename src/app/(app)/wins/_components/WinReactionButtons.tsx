"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { toggleReaction } from "../actions";
import type { WinReactionKind } from "@prisma/client";

const REACTIONS: { kind: WinReactionKind; emoji: string; label: string }[] = [
  { kind: "FIRE", emoji: "🔥", label: "Fire" },
  { kind: "CLAP", emoji: "👏", label: "Clap" },
  { kind: "YAY", emoji: "🙌", label: "Yay" },
];

export function WinReactionButtons({
  winId,
  counts,
  mine,
  layout = "row",
}: {
  winId: string;
  counts: Partial<Record<WinReactionKind, number>>;
  mine: WinReactionKind[];
  layout?: "row" | "column";
}) {
  const [pending, start] = useTransition();

  return (
    <div
      className={cn(
        "flex gap-2",
        layout === "column" ? "flex-col items-stretch" : "flex-wrap items-center",
        pending && "opacity-70",
      )}
    >
      {REACTIONS.map((r) => {
        const active = mine.includes(r.kind);
        const count = counts[r.kind] ?? 0;
        return (
          <button
            key={r.kind}
            type="button"
            disabled={pending}
            onClick={() => start(() => toggleReaction(winId, r.kind))}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              layout === "column" && "w-full",
              active
                ? "bg-orange-100 text-orange-800 ring-1 ring-orange-200"
                : "bg-ink-100 text-ink-600 hover:bg-ink-200",
            )}
          >
            <span aria-hidden>{r.emoji}</span>
            <span>{r.label}</span>
            <span className="tabular-nums font-semibold">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
