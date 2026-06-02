"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type InterviewerOption = {
  id: string;
  label: string;
  searchText: string;
};

export function RoundInterviewerField({
  options,
  defaultUserId = "",
  defaultName = "",
  userIdInputName = "interviewerUserId",
  nameInputName = "interviewerName",
  inputId: inputIdProp,
}: {
  options: InterviewerOption[];
  defaultUserId?: string;
  defaultName?: string;
  userIdInputName?: string;
  nameInputName?: string;
  inputId?: string;
}) {
  const genId = useId();
  const inputId = inputIdProp ?? genId;
  const defaultLabel =
    defaultUserId && options.find((o) => o.id === defaultUserId)?.label
      ? options.find((o) => o.id === defaultUserId)!.label
      : defaultName;

  const [display, setDisplay] = useState(defaultLabel);
  const [userId, setUserId] = useState(defaultUserId);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const filtered = useMemo(() => {
    const q = display.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.searchText.includes(q));
  }, [display, options]);

  const maxIx = filtered.length > 0 ? filtered.length - 1 : 0;
  const displayHighlight = filtered.length === 0 ? 0 : Math.min(highlight, maxIx);
  const showList = open && filtered.length > 0;

  const cancelBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  };

  const scheduleClose = () => {
    cancelBlur();
    blurTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const pick = (opt: InterviewerOption) => {
    setDisplay(opt.label);
    setUserId(opt.id);
    setOpen(false);
  };

  const onDisplayChange = (next: string) => {
    setDisplay(next);
    const exact = options.find(
      (o) => o.label.toLowerCase() === next.trim().toLowerCase() || o.id === next.trim(),
    );
    if (exact) {
      setUserId(exact.id);
    } else {
      setUserId("");
    }
    setOpen(true);
    setHighlight(0);
  };

  return (
    <div className="relative min-w-[10rem]">
      <input type="hidden" name={userIdInputName} value={userId} />
      <input type="hidden" name={nameInputName} value={userId ? "" : display.trim()} />
      <div className="relative">
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          aria-label="Interviewer"
          placeholder="Team member or name…"
          value={display}
          onChange={(e) => onDisplayChange(e.target.value)}
          onFocus={() => {
            cancelBlur();
            setOpen(true);
          }}
          onBlur={scheduleClose}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && filtered[displayHighlight]) {
              e.preventDefault();
              pick(filtered[displayHighlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className={cn(
            "w-full rounded-lg border border-ink-200 bg-white pl-3 pr-9 py-2 text-sm text-ink-800",
            "placeholder:text-ink-400 outline-none transition-[box-shadow,border-color]",
            "focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-500/25",
          )}
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
      </div>
      {showList ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg"
        >
          {filtered.map((opt, i) => (
            <li key={opt.id} role="option" aria-selected={i === displayHighlight}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(opt)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm text-ink-800 hover:bg-sky-50",
                  i === displayHighlight && "bg-sky-50",
                )}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
