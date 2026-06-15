import type { Role } from "@/generated/prisma";
import { hasPermission } from "@/lib/permissions";

const HR_EXEC_ROLES: Role[] = ["HR", "CEO", "ADMIN"];

export function canManageDeptWork(args: {
  viewerRole: Role;
  viewerPermissions?: string[] | null;
  viewerUserId: string;
  viewerHeadedDepartmentId: string | null;
  departmentId: string;
}): boolean {
  if (HR_EXEC_ROLES.includes(args.viewerRole)) return true;
  if (args.viewerRole === "DEPT_HEAD" && args.viewerHeadedDepartmentId === args.departmentId) return true;
  if (args.viewerRole === "MANAGER") return true;
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
  if (HR_EXEC_ROLES.includes(args.viewerRole)) return true;
  if (args.viewerRole === "DEPT_HEAD" && args.viewerHeadedDepartmentId) return true;
  if (args.viewerRole === "MANAGER") return true;
  return hasPermission({ permissions: args.viewerPermissions ?? [] }, "TASKS_VIEW_ALL");
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
