import type { Role } from "@/generated/prisma";
import { hasPermission } from "@/lib/permissions";

const HR_EXEC_ROLES: Role[] = ["HR", "CEO", "ADMIN"];

/** Who may see which employees' tasks: admin/HR/CEO → all; dept head → their dept; manager → direct reports. */
export type TeamMemberVisibilityScope =
  | { kind: "all" }
  | { kind: "department"; departmentId: string }
  | { kind: "direct_reports"; managerId: string }
  | { kind: "none" };

export function getTeamMemberVisibilityScope(args: {
  viewerRole: Role;
  viewerUserId: string;
  viewerHeadedDepartmentId: string | null;
}): TeamMemberVisibilityScope {
  if (HR_EXEC_ROLES.includes(args.viewerRole)) return { kind: "all" };
  if (args.viewerRole === "DEPT_HEAD" && args.viewerHeadedDepartmentId) {
    return { kind: "department", departmentId: args.viewerHeadedDepartmentId };
  }
  if (args.viewerRole === "MANAGER") {
    return { kind: "direct_reports", managerId: args.viewerUserId };
  }
  return { kind: "none" };
}

export function teamMemberPrismaFilter(scope: TeamMemberVisibilityScope): {
  departmentId?: string;
  managerId?: string;
} {
  switch (scope.kind) {
    case "all":
      return {};
    case "department":
      return { departmentId: scope.departmentId };
    case "direct_reports":
      return { managerId: scope.managerId };
    case "none":
      return { managerId: "__no_visible_team_members__" };
  }
}

export function canViewEmployeeTeamTasks(args: {
  viewerRole: Role;
  viewerUserId: string;
  viewerHeadedDepartmentId: string | null;
  employeeManagerId: string | null;
  employeeDepartmentId: string | null;
}): boolean {
  const scope = getTeamMemberVisibilityScope(args);
  switch (scope.kind) {
    case "all":
      return true;
    case "department":
      return args.employeeDepartmentId === scope.departmentId;
    case "direct_reports":
      return args.employeeManagerId === scope.managerId;
    case "none":
      return false;
  }
}

export function canManageDeptWork(args: {
  viewerRole: Role;
  viewerPermissions?: string[] | null;
  viewerUserId: string;
  viewerHeadedDepartmentId: string | null;
  departmentId: string;
}): boolean {
  if (HR_EXEC_ROLES.includes(args.viewerRole)) return true;
  if (args.viewerRole === "DEPT_HEAD" && args.viewerHeadedDepartmentId === args.departmentId) return true;
  return hasPermission({ permissions: args.viewerPermissions ?? [] }, "ADMIN_PANEL");
}

export function canAssignDailyTasks(args: {
  viewerRole: Role;
  viewerPermissions?: string[] | null;
  viewerUserId: string;
  viewerHeadedDepartmentId: string | null;
  assigneeManagerId: string | null;
  assigneeDepartmentId: string | null;
}): boolean {
  if (HR_EXEC_ROLES.includes(args.viewerRole)) return true;
  if (args.viewerRole === "DEPT_HEAD" && args.viewerHeadedDepartmentId === args.assigneeDepartmentId) return true;
  if (args.viewerRole === "MANAGER" && args.assigneeManagerId === args.viewerUserId) return true;
  return hasPermission({ permissions: args.viewerPermissions ?? [] }, "TASKS_VIEW_ALL");
}

export function canViewTeamWork(args: {
  viewerRole: Role;
  viewerPermissions?: string[] | null;
  viewerUserId: string;
  viewerHeadedDepartmentId: string | null;
}): boolean {
  return (
    getTeamMemberVisibilityScope(args).kind !== "none" ||
    hasPermission({ permissions: args.viewerPermissions ?? [] }, "TASKS_VIEW_ALL")
  );
}

export function canManageDeptOkrs(args: {
  viewerRole: Role;
  viewerHeadedDepartmentId: string | null;
  departmentId: string;
}): boolean {
  if (HR_EXEC_ROLES.includes(args.viewerRole)) return true;
  return args.viewerRole === "DEPT_HEAD" && args.viewerHeadedDepartmentId === args.departmentId;
}

export const WORK_ADMIN_ROLES: Role[] = ["HR", "CEO", "ADMIN"];

export function canViewDailyWorkTask(args: {
  viewerRole: Role;
  viewerPermissions?: string[] | null;
  viewerUserId: string;
  viewerHeadedDepartmentId: string | null;
  assigneeId: string;
  assigneeManagerId: string | null;
  assigneeDepartmentId: string | null;
}): boolean {
  if (args.viewerUserId === args.assigneeId) return true;
  return canAssignDailyTasks({
    viewerRole: args.viewerRole,
    viewerPermissions: args.viewerPermissions,
    viewerUserId: args.viewerUserId,
    viewerHeadedDepartmentId: args.viewerHeadedDepartmentId,
    assigneeManagerId: args.assigneeManagerId,
    assigneeDepartmentId: args.assigneeDepartmentId,
  });
}

export function canEditDailyWorkTaskDetails(args: {
  viewerUserId: string;
  assigneeId: string;
}): boolean {
  return args.viewerUserId === args.assigneeId;
}
