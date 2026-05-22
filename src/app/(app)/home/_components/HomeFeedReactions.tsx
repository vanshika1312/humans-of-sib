"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_EMOJIS = ["👍", "❤️", "🎉", "😂", "😮", "😢"] as const;
const PICKER_EMOJIS = [
  ...QUICK_EMOJIS,
  "👏",
  "🙏",
  "🔥",
  "💯",
  "✨",
  "🤝",
  "✅",
  "❌",
  "⭐️",
  "🌟",
  "👀",
  "🤩",
  "😄",
  "😅",
  "🤔",
  "😮‍💨",
  "😡",
  "🤯",
  "🥳",
  "💪",
  "🫶",
  "🧠",
  "📣",
  "📌",
  "🧡",
  "💙",
  "💚",
  "💛",
  "💜",
  "🖤",
  "🤍",
  "🚀",
  "🎯",
  "🏆",
  "📈",
  "🎁",
  "🍰",
] as const;

type Props = {
  postId: string;
  initialCounts?: Record<string, number>;
  initialMine?: string[];
  className?: string;
};

export function HomeFeedReactions({ postId, initialCounts, initialMine, className }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts ?? {});
  const [mine, setMine] = useState<Set<string>>(() => new Set(initialMine ?? []));
  const [busy, setBusy] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState("");
  const customRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const visibleEmojis = useMemo(() => {
    const withCounts = Object.entries(counts)
      .filter(([, c]) => (c ?? 0) > 0)
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .map(([emoji]) => emoji);
    const mineFirst = Array.from(mine);
    const merged = new Set<string>([...mineFirst, ...withCounts, ...QUICK_EMOJIS]);
    return Array.from(merged).slice(0, 12);
  }, [counts, mine]);

  const pickerEmojis = useMemo(() => {
    const query = q.trim();
    if (!query.length) return Array.from(new Set<string>(PICKER_EMOJIS));
    // Search is intentionally simple: allow pasting an emoji or filtering by substring.
    return Array.from(new Set<string>(PICKER_EMOJIS)).filter((e) => e.includes(query));
  }, [q]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) setPickerOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);

  const onToggle = async (emojiRaw: string) => {
    if (busy) return;
    const emoji = emojiRaw.trim();
    if (!emoji.length) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/home-feed/post/${encodeURIComponent(postId)}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        counts?: Record<string, number>;
        mine?: string[];
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to react");

      setCounts(data.counts ?? {});
      setMine(new Set(data.mine ?? []));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className={cn("relative flex items-center gap-1.5 flex-wrap", className)}>
      {visibleEmojis.map((emoji) => {
        const c = counts[emoji] ?? 0;
        const active = mine.has(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            disabled={busy}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "border-sky-200 bg-sky-50 text-sky-700" : "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
            )}
            aria-pressed={active}
            aria-label={`React ${emoji}`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {c > 0 ? <span className="text-[11px] text-ink-500">{c}</span> : null}
          </button>
        );
      })}

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setPickerOpen((v) => !v);
          setQ("");
          setCustom("");
          requestAnimationFrame(() => customRef.current?.focus());
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
          "border-ink-200 bg-white text-ink-600 hover:bg-ink-50",
        )}
        aria-expanded={pickerOpen}
        aria-label="Add reaction"
      >
        <Plus className="size-3.5" aria-hidden />
        React
      </button>

      {busy ? <Loader2 className="size-3.5 animate-spin text-ink-400" aria-hidden /> : null}

      {pickerOpen ? (
        <div className="absolute left-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-ink-100 bg-white shadow-lg shadow-ink-900/10 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-100">
            <div className="relative flex-1">
              <Search className="size-4 text-ink-400 absolute left-2 top-1/2 -translate-y-1/2" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search (or paste an emoji)…"
                className={cn(
                  "w-full rounded-lg border border-ink-200 bg-white pl-8 pr-2.5 py-2 text-xs text-ink-800",
                  "placeholder:text-ink-400 outline-none transition-[box-shadow,border-color]",
                  "focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25",
                )}
              />
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-50"
              onClick={() => setPickerOpen(false)}
              aria-label="Close"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-10 gap-1">
              {pickerEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={cn(
                    "h-8 w-8 rounded-lg border text-base leading-none transition-colors",
                    mine.has(emoji) ? "border-sky-200 bg-sky-50" : "border-ink-200 bg-white hover:bg-ink-50",
                  )}
                  onClick={() => {
                    void onToggle(emoji);
                    setPickerOpen(false);
                  }}
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                ref={customRef}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Custom emoji…"
                className={cn(
                  "flex-1 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs text-ink-800",
                  "placeholder:text-ink-400 outline-none transition-[box-shadow,border-color]",
                  "focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25",
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!custom.trim()) return;
                    void onToggle(custom);
                    setPickerOpen(false);
                  }
                  if (e.key === "Escape") {
                    setPickerOpen(false);
                  }
                }}
              />
              <button
                type="button"
                className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                onClick={() => {
                  if (!custom.trim()) return;
                  void onToggle(custom);
                  setPickerOpen(false);
                }}
              >
                Add
              </button>
            </div>
            <div className="mt-2 text-[11px] text-ink-400">
              Tip: you can also paste any emoji (macOS: Ctrl+Cmd+Space).
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

