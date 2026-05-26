import { HIRING_TEMPLATE_PLACEHOLDER_HINTS } from "@/lib/hiring-template-placeholders";

export function PlaceholderCheatsheet({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-2">Placeholders</p>
      <ul className="text-xs text-ink-600 space-y-1">
        {HIRING_TEMPLATE_PLACEHOLDER_HINTS.map((h) => (
          <li key={h.token}>
            <code className="text-sky-800 bg-sky-50 px-1 rounded">{h.token}</code>
            <span className="text-ink-400"> — {h.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
