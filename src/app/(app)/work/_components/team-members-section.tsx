"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import type { EmployeeDailySnapshot } from "@/lib/work-tracking/snapshots";

type DepartmentOption = { id: string; name: string };

function EodBadge({ status }: { status: string }) {
  const tone: Record<string, "green" | "orange" | "red" | "ink"> = {
    SUBMITTED: "green",
    DRAFT: "orange",
    MISSING: "red",
    NONE: "ink",
  };
  const label: Record<string, string> = {
    SUBMITTED: "Submitted",
    DRAFT: "Pending",
    MISSING: "Missing",
    NONE: "None",
  };
  return <Badge tone={tone[status] ?? "ink"}>{label[status] ?? status}</Badge>;
}

function efficiencyBarColor(pct: number): string {
  if (pct >= 75) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function DepartmentFilter({
  departments,
  deptParam,
  dateParam,
  assigneeParam,
}: {
  departments: DepartmentOption[];
  deptParam: string | undefined;
  dateParam: string;
  assigneeParam: string | undefined;
}) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams({ date: dateParam });
    if (assigneeParam) params.set("assignee", assigneeParam);
    const value = e.target.value;
    if (value) params.set("dept", value);
    router.push(`/work/team?${params.toString()}`);
  }

  return (
    <div className="max-w-xs">
      <Label htmlFor="dept-filter">Department</Label>
      <Select id="dept-filter" value={deptParam ?? ""} onChange={onChange}>
        <option value="">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function TeamMembersSection({
  viewerId,
  dateParam,
  deptParam,
  assigneeParam,
  departments,
  showDeptFilter,
  showDeptColumn,
  snapshot,
}: {
  viewerId: string;
  dateParam: string;
  deptParam: string | undefined;
  assigneeParam: string | undefined;
  departments: DepartmentOption[];
  showDeptFilter: boolean;
  showDeptColumn: boolean;
  snapshot: EmployeeDailySnapshot[];
}) {
  function memberHref(userId: string) {
    const params = new URLSearchParams({ date: dateParam, assignee: userId });
    if (deptParam) params.set("dept", deptParam);
    return `/work/team?${params.toString()}`;
  }

  const canSubmitEod = (row: EmployeeDailySnapshot) =>
    row.userId === viewerId &&
    row.assignedCount > 0 &&
    row.eodStatus !== "SUBMITTED";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">EOD submissions — {dateParam}</CardTitle>
          <p className="text-xs text-ink-500 mt-1">
            EOD is submitted by each team member on Daily Work → EOD report.
          </p>
        </div>
        {showDeptFilter && (
          <DepartmentFilter
            departments={departments}
            deptParam={deptParam}
            dateParam={dateParam}
            assigneeParam={assigneeParam}
          />
        )}
      </CardHeader>
      <CardContent>
        {snapshot.length === 0 ? (
          <p className="text-sm text-ink-500 py-4 text-center">No team members match this filter.</p>
        ) : (
          <div className="space-y-0 divide-y divide-ink-100">
            {snapshot.map((row) => (
              <div
                key={row.userId}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-[140px] flex-1">
                  <Link
                    href={memberHref(row.userId)}
                    className="flex items-center gap-2 font-medium text-ink-700 hover:text-sky-600"
                  >
                    <Avatar name={row.name} size="sm" />
                    <div>
                      <span>{row.name}</span>
                      {showDeptColumn && row.departmentName && (
                        <span className="block text-xs font-normal text-ink-400">
                          {row.departmentName}
                        </span>
                      )}
                      {row.assignedCount > 1 && (
                        <span className="block text-xs font-normal text-ink-400">
                          {row.assignedCount} tasks
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
                <div className="flex-1 min-w-[120px] max-w-xs">
                  {row.assignedCount > 0 ? (
                    <>
                      <div className="h-1.5 bg-ink-100 rounded overflow-hidden">
                        <div
                          className={`h-full rounded transition-all ${efficiencyBarColor(row.efficiencyPct)}`}
                          style={{ width: `${row.efficiencyPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-ink-500 mt-1">
                        <span>
                          {row.deliveredQuantity} / {row.assignedQuantity}
                        </span>
                        <span className="font-medium text-ink-700">{row.efficiencyPct}%</span>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-ink-400">No tasks</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <EodBadge status={row.eodStatus} />
                  {canSubmitEod(row) && (
                    <Link
                      href={`/work?date=${dateParam}&tab=eod`}
                      className="text-xs font-medium text-sky-600 hover:text-sky-800 whitespace-nowrap"
                    >
                      Submit EOD
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
