import type { Role } from "@/generated/prisma";

/** Dept heads, managers, and workspace leads who may raise headcount requests. */
export const JOB_REQUISITION_SUBMITTER_ROLES: Role[] = [
  "DEPT_HEAD",
  "MANAGER",
  "CEO",
  "ADMIN",
  "HR",
];

export function canSubmitJobRequisition(role: Role): boolean {
  return JOB_REQUISITION_SUBMITTER_ROLES.includes(role);
}

export function canPickDepartmentOnRequisition(role: Role): boolean {
  return role === "CEO" || role === "ADMIN" || role === "HR";
}
