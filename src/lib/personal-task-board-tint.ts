/** Jira-like board column shell (neutral). */
export function stageColumnShell(): string {
  return "bg-[#EBECF0] border border-[#DFE1E6] text-slate-800";
}

/** Card surface inside a board column. */
export function taskCardSurface(): string {
  return "bg-white ring-1 ring-slate-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.06)]";
}
