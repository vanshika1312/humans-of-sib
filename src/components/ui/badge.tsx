import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Tone = "sky" | "orange" | "sun" | "ink" | "green" | "red";

const toneStyles: Record<Tone, string> = {
  sky: "bg-sky-50 text-sky-700",
  orange: "bg-orange-50 text-orange-700",
  sun: "bg-sun-50 text-ink-600",
  ink: "bg-ink-100 text-ink-600",
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "ink", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
        toneStyles[tone],
        className,
      )}
      {...props}
    />
  );
}
