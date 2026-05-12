import type { Prisma } from "@/generated/prisma";

export type AttendanceApproverContext = {
  id: string;
  role: string;
  headedDeptId: string | null;
};

/**
 * Narrow pending approval queues at query time (matches {@link canApproveForEmployee}).
 * HR / CEO / ADMIN: no filter (company-wide). Others: manager or department scope.
 */
export function pendingApprovalUserWhere(viewer: AttendanceApproverContext): Prisma.UserWhereInput | undefined {
  if (["HR", "CEO", "ADMIN"].includes(viewer.role)) return undefined;
  if (viewer.role === "MANAGER") return { managerId: viewer.id };
  if (viewer.role === "DEPT_HEAD" && viewer.headedDeptId) {
    return { departmentId: viewer.headedDeptId };
  }
  return { id: { in: [] } };
}

/** True if viewer may approve attendance / leave for this employee row. */
export function canApproveForEmployee(
  viewer: AttendanceApproverContext,
  emp: { id: string; managerId: string | null; departmentId: string | null },
): boolean {
  if (["HR", "CEO", "ADMIN"].includes(viewer.role)) return true;
  if (viewer.role === "MANAGER" && emp.managerId === viewer.id) return true;
  if (viewer.role === "DEPT_HEAD" && viewer.headedDeptId && emp.departmentId === viewer.headedDeptId) return true;
  return false;
}

/** Prisma where-clause fragment: active employees this role can manage for attendance dashboards. */
export function manageableEmployeesWhere(me: AttendanceApproverContext): {
  status: "ACTIVE";
  OR?: { managerId?: string; departmentId?: string }[];
  id?: { in: string[] };
} {
  const parts: { managerId?: string; departmentId?: string }[] = [];
  if (me.role === "MANAGER") parts.push({ managerId: me.id });
  if (me.role === "DEPT_HEAD" && me.headedDeptId) parts.push({ departmentId: me.headedDeptId });

  if (["HR", "CEO", "ADMIN"].includes(me.role)) return { status: "ACTIVE" };
  if (parts.length === 0) return { status: "ACTIVE", id: { in: [] } };
  return { status: "ACTIVE", OR: parts };
}
