"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pick from suggestions or submit any typed value (combo box). */
export function CreatableCombo({
  name,
  label,
  options,
  required,
  defaultValue = "",
  placeholder = "Select…",
  className,
  inputClassName,
}: {
  name: string;
  label: string;
  options: string[];
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const id = useId();
  const [value, setValue] = useState(defaultValue);
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
    const q = value.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, value]);

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

  const pick = (choice: string) => {
    setValue(choice);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <label htmlFor={id} className="block text-[10px] font-semibold uppercase tracking-wider text-white/38 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          autoComplete="off"
          required={required}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
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
            } else if (e.key === "Enter" && filtered[displayHighlight] !== undefined) {
              e.preventDefault();
              pick(filtered[displayHighlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className={cn(
            "w-full rounded-lg border border-white/12 bg-white/[0.06] pl-3 pr-9 py-2.5 text-sm text-white/90",
            "placeholder:text-white/28 outline-none transition-[box-shadow,border-color]",
            "focus-visible:border-orange-400/70 focus-visible:ring-2 focus-visible:ring-orange-500/35",
            inputClassName,
          )}
        />
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-white/35"
          aria-hidden
        />
      </div>
      {showList && (
        <ul
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-white/12 bg-[#16181f] py-1 shadow-xl shadow-black/50",
          )}
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.map((opt, idx) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                aria-selected={idx === displayHighlight}
                className={cn(
                  "w-full truncate px-3 py-2 text-left text-xs text-white/85 hover:bg-orange-500/15",
                  idx === displayHighlight && "bg-orange-500/25",
                )}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => pick(opt)}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
