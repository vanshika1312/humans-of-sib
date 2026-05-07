import Link from "next/link";
import { cn } from "@/lib/utils";

export type AttendanceTab = "attendance" | "requests";

type Props = {
  active: AttendanceTab;
  viewYear: number;
  viewMonth: number;
};

export function AttendanceTabNav({ active, viewYear, viewMonth }: Props) {
  const qs = (tab: AttendanceTab) =>
    `/attendance?tab=${tab}&year=${viewYear}&month=${viewMonth}`;

  return (
    <nav className="flex flex-wrap gap-0 sm:gap-1 border-b border-ink-200" aria-label="Attendance sections">
      <Link
        href={qs("attendance")}
        className={cn(
          "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t-md",
          active === "attendance"
            ? "border-sky-500 text-sky-800 bg-sky-50/50"
            : "border-transparent text-ink-500 hover:text-ink-700 hover:bg-ink-50/80",
        )}
      >
        Attendance &amp; log
      </Link>
      <Link
        href={qs("requests")}
        className={cn(
          "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t-md",
          active === "requests"
            ? "border-sky-500 text-sky-800 bg-sky-50/50"
            : "border-transparent text-ink-500 hover:text-ink-700 hover:bg-ink-50/80",
        )}
      >
        Leave &amp; regularisation
      </Link>
    </nav>
  );
}
