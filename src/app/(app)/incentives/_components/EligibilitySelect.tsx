"use client";

import { useTransition } from "react";

export type EligibilityOption = { id: string; label: string; color: string; order?: number };

const COLOR_CLASSES: Record<string, string> = {
  green: "bg-green-50 text-green-700 ring-green-400",
  red:   "bg-red-50 text-red-600 ring-red-400",
  amber: "bg-amber-50 text-amber-700 ring-amber-400",
  blue:  "bg-blue-50 text-blue-700 ring-blue-400",
  gray:  "bg-ink-50 text-ink-500 ring-ink-300",
};

export function EligibilitySelect({
  sheetId,
  currentOptionId,
  options,
  setEligibilityAction,
}: {
  sheetId: string;
  currentOptionId: string | null;
  options: EligibilityOption[];
  setEligibilityAction: (fd: FormData) => Promise<void>;
}) {
  const [pending, start] = useTransition();

  function submit(optionId: string) {
    const fd = new FormData();
    fd.set("sheetId", sheetId);
    fd.set("eligibilityOptionId", optionId);
    start(() => setEligibilityAction(fd));
  }

  if (options.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${pending ? "opacity-50 pointer-events-none" : ""}`}>
      {options.map((o) => {
        const isActive = o.id === currentOptionId;
        const cls = COLOR_CLASSES[o.color] ?? COLOR_CLASSES.gray;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => submit(isActive ? "" : o.id)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all ${
              isActive
                ? `${cls} ring-2 ring-offset-1`
                : "bg-ink-50 text-ink-400 hover:bg-ink-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
