import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { displayName } from "@/lib/user-display-name";
import { cn } from "@/lib/utils";

export type TeamMemberForTasks = {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  image: string | null;
  title: string | null;
};

export function TeamTaskMemberCards({
  members,
  openCounts,
  viewingUserId,
}: {
  members: TeamMemberForTasks[];
  openCounts: Record<string, number>;
  viewingUserId: string;
}) {
  if (members.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {members.map((u) => {
        const dn = displayName(u);
        const open = openCounts[u.id] ?? 0;
        const isActive = u.id === viewingUserId;

        return (
          <Link
            key={u.id}
            href={`/my-tasks?userId=${u.id}`}
            className={cn(
              "group flex items-center gap-3 rounded-xl border bg-white px-4 py-3.5 shadow-sm transition-all hairline hover:border-sky-300 hover:shadow-md",
              isActive && "ring-2 ring-sky-400 border-sky-200 shadow-md",
            )}
          >
            <Avatar src={u.image} name={dn} size="lg" className="ring-ink-100 group-hover:ring-sky-100" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink-800 truncate group-hover:text-sky-700 transition-colors">{dn}</div>
              <div className="text-xs text-ink-500 truncate mt-0.5">{u.title || "Team member"}</div>
              <div className="text-[11px] text-ink-400 mt-1">
                {open === 0 ? "No active tasks on board" : `${open} active on board`}
              </div>
            </div>
            <ChevronRight className="size-5 text-ink-300 shrink-0 group-hover:text-sky-500 transition-colors" />
          </Link>
        );
      })}
    </div>
  );
}
