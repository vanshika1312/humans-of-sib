import type { Role } from "@/generated/prisma";

const HR_EXEC_ROLES: Role[] = ["HR", "CEO", "ADMIN"];

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
