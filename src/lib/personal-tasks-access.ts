import type { EmployeeStatus, Role } from "@/generated/prisma";
import { hasPermission } from "@/lib/permissions";

const HR_EXEC_ROLES: Role[] = ["HR", "CEO", "ADMIN"];
const TASKS_GLOBAL_ROLES: Role[] = ["CEO", "ADMIN"];

export type PeopleProfileAccess = {
  level: "limited" | "extended" | "full";
  canSeeSalary: boolean;
  showEngagementSections: boolean;
};

/**
 * Who may see what on /people/[id] and directory cards.
 * - limited: name, department, access role, manager, date of joining (peers for typical employees).
 * - extended: + contact, address, emergency contacts, parents (+ engagement for managers / dept heads).
 * - full: + compensation; HR / CEO / Admin (or self on own profile).
 */
export function getPeopleProfileAccess(args: {
  viewerUserId: string;
  viewerRole: Role;
  subjectUserId: string;
  subjectManagerId: string | null;
  subjectDepartmentId: string | null;
  viewerHeadedDepartmentId: string | null;
}): PeopleProfileAccess {
  if (args.viewerUserId === args.subjectUserId) {
    return { level: "full", canSeeSalary: true, showEngagementSections: true };
  }

  if (HR_EXEC_ROLES.includes(args.viewerRole)) {
    return { level: "full", canSeeSalary: true, showEngagementSections: true };
  }

  const isDirectManager = args.subjectManagerId === args.viewerUserId;
  const isDeptHeadOfSubject =
    args.viewerRole === "DEPT_HEAD" &&
    args.viewerHeadedDepartmentId != null &&
    args.subjectDepartmentId === args.viewerHeadedDepartmentId;

  if (
    (args.viewerRole === "MANAGER" || args.viewerRole === "DEPT_HEAD") &&
    (isDirectManager || isDeptHeadOfSubject)
  ) {
    return { level: "extended", canSeeSalary: false, showEngagementSections: true };
  }

  return { level: "limited", canSeeSalary: false, showEngagementSections: false };
}

/** PAN / Aadhaar: only self and HR / CEO / Admin. */
export function canSeeGovernmentIds(args: {
  viewerUserId: string;
  viewerRole: Role;
  subjectUserId: string;
}): boolean {
  if (args.viewerUserId === args.subjectUserId) return true;
  return HR_EXEC_ROLES.includes(args.viewerRole);
}

/** Whether viewer may view this owner's personal task board. */
export function canViewPersonalTasks(args: {
  viewerUserId: string;
  viewerRole: Role;
  viewerPermissions?: string[] | null;
  ownerUserId: string;
  ownerManagerId: string | null;
  ownerDepartmentId: string | null;
  viewerHeadedDepartmentId: string | null;
  hasExplicitGrant?: boolean;
}): boolean {
  if (args.viewerUserId === args.ownerUserId) return true;
  if (TASKS_GLOBAL_ROLES.includes(args.viewerRole)) return true;
  if (hasPermission({ permissions: args.viewerPermissions ?? [] }, "TASKS_VIEW_ALL")) return true;
  if (args.hasExplicitGrant) return true;
  if (args.viewerRole === "MANAGER" && args.ownerManagerId === args.viewerUserId) return true;
  if (
    args.viewerRole === "DEPT_HEAD" &&
    args.viewerHeadedDepartmentId &&
    args.ownerDepartmentId === args.viewerHeadedDepartmentId
  ) {
    return true;
  }
  return false;
}

export function canEditPersonalTasks(viewerUserId: string, ownerUserId: string): boolean {
  return viewerUserId === ownerUserId;
}

export function canAssignPersonalTasks(args: {
  viewerUserId: string;
  viewerStatus: EmployeeStatus;
  assigneeUserId: string;
  assigneeStatus: EmployeeStatus;
}): boolean {
  if (args.viewerStatus !== "ACTIVE") return false;
  if (args.assigneeStatus !== "ACTIVE") return false;
  return args.viewerUserId !== "";
}

export function canEditPersonalTask(args: {
  viewerUserId: string;
  ownerUserId: string;
  assignedByUserId: string | null;
}): boolean {
  if (args.viewerUserId === args.ownerUserId) return true;
  return args.assignedByUserId === args.viewerUserId;
}

/**
 * Delete rules for personal tasks:
 * - If the task is assigned to someone else (assignedByUserId != ownerUserId), only the assigner may delete.
 * - Otherwise (self-created / legacy null assignedBy), the owner may delete.
 */
export function canDeletePersonalTask(args: {
  viewerUserId: string;
  ownerUserId: string;
  assignedByUserId: string | null;
}): boolean {
  if (args.assignedByUserId && args.assignedByUserId !== args.ownerUserId) {
    return args.viewerUserId === args.assignedByUserId;
  }
  return args.viewerUserId === args.ownerUserId;
}

export function canViewPersonalTask(args: {
  viewerUserId: string;
  viewerRole: Role;
  viewerPermissions?: string[] | null;
  ownerUserId: string;
  ownerManagerId: string | null;
  ownerDepartmentId: string | null;
  viewerHeadedDepartmentId: string | null;
  assignedByUserId: string | null;
  hasExplicitGrant?: boolean;
}): boolean {
  if (canEditPersonalTask(args)) return true;
  return canViewPersonalTasks({
    viewerUserId: args.viewerUserId,
    viewerRole: args.viewerRole,
    viewerPermissions: args.viewerPermissions,
    ownerUserId: args.ownerUserId,
    ownerManagerId: args.ownerManagerId,
    ownerDepartmentId: args.ownerDepartmentId,
    viewerHeadedDepartmentId: args.viewerHeadedDepartmentId,
    hasExplicitGrant: args.hasExplicitGrant,
  });
}

export function roleLabel(role: Role): string {
  const map: Record<Role, string> = {
    EMPLOYEE: "Employee",
    MANAGER: "Manager",
    DEPT_HEAD: "Department head",
    HR: "HR",
    CEO: "CEO",
    ADMIN: "Admin",
  };
  return map[role];
}
