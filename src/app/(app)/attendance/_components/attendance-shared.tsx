export const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type AttendanceMode = "OFFICE" | "WFH";

export function modeStyle(mode: AttendanceMode) {
  if (mode === "WFH") return { bg: "bg-amber-100 text-amber-700", pill: "bg-amber-50 text-amber-700", label: "🏠 WFH" };
  return { bg: "bg-sky-100 text-sky-700", pill: "bg-sky-50 text-sky-700", label: "🏢 Office" };
}

export function sourceBadgeTone(src: string): "sky" | "sun" | "orange" | "ink" {
  if (src === "BIOMETRIC") return "orange";
  if (src === "REGULARISED") return "sun";
  return "sky";
}

export function sourceShort(src: string) {
  if (src === "BIOMETRIC") return "Bio";
  if (src === "REGULARISED") return "Reg";
  return "App";
}

export function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

/** Y-M-D for UTC calendar day (matches @db.Date attendance rows). */
export function utcIsoDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function leaveApprovalsBalanceLabel(type: string): "sick" | "casual paid" {
  return type === "SICK" ? "sick" : "casual paid";
}

export function MiniBank({
  label,
  left,
  total,
  subtitle,
}: {
  label: string;
  left: number;
  total: number;
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg bg-ink-50 p-3">
      <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold text-ink-700">{Math.max(0, left)}</div>
      <div className="text-[11px] text-ink-400">
        of {total} day{total !== 1 ? "s" : ""} accrued this half
        {subtitle ? ` · ${subtitle}` : ""}
      </div>
    </div>
  );
}
