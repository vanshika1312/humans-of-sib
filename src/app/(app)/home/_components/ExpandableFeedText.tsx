"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Feed post body with CSS line-clamp + a "Read more / Show less" toggle when the text actually overflows. */
export function ExpandableFeedText({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => setOverflowing(el.scrollHeight - el.clientHeight > 1);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div>
      <p
        ref={ref}
        className={cn(
          "text-sm text-ink-500 mt-1 whitespace-pre-wrap",
          !expanded && "line-clamp-3",
        )}
      >
        {children}
      </p>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-medium text-sky-600 hover:underline mt-0.5"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
