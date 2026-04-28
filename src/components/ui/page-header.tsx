import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, emoji, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink-700 flex items-center gap-3">
          {emoji && <span className="text-3xl">{emoji}</span>}
          {title}
        </h1>
        {subtitle && <p className="text-sm text-ink-400 mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({ emoji = "✨", title, description, action }: { emoji?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 px-6 rounded-xl border border-dashed border-ink-200 bg-white">
      <div className="text-4xl mb-3">{emoji}</div>
      <h3 className="text-base font-semibold text-ink-600">{title}</h3>
      {description && <p className="text-sm text-ink-400 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
