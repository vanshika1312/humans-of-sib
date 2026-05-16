import { EmployeeStatus, Role } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const ROLES = new Set<string>(Object.values(Role));
const STATUSES = new Set<string>(Object.values(EmployeeStatus));

export function parseRole(raw: unknown): Role | null {
  if (typeof raw !== "string" || !ROLES.has(raw)) return null;
  return raw as Role;
}

export function parseEmployeeStatus(raw: unknown): EmployeeStatus | null {
  if (typeof raw !== "string" || !STATUSES.has(raw)) return null;
  return raw as EmployeeStatus;
}

/** CEO and workspace Admin — full edits including salary & elevated roles */
export function isWorkspacePowerUser(actorRole: Role) {
  return actorRole === "CEO" || actorRole === "ADMIN";
}

/** New profile: HR must not onboard members as Admin/CEO without a workspace power user doing it elsewhere. */
export function assertHrCreateRole(actorRole: Role, desired: Role) {
  if (actorRole !== "HR") return;
  if (desired === "ADMIN" || desired === "CEO") throw new AdminMutationError("hr_role_guard");
}

/** Existing profile: HR edits must not alter Admin or CEO staffing lines except keeping the same tier (name-only flows post same role). */
export function assertHrUpdateRole(actorRole: Role, prev: Role, next: Role) {
  if (actorRole !== "HR") return;
  if (prev === next) return;
  if (prev === "ADMIN" || prev === "CEO" || next === "ADMIN" || next === "CEO") {
    throw new AdminMutationError("hr_role_guard");
  }
}

export async function remainingAdminPeers(excludeUserId: string): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", id: { not: excludeUserId } },
  });
}

/** Block demoting/downgrading away the lone Workspace Admin unless another Admin exists first. */
export async function assertNotRemovingLastWorkspaceAdmin(memberId: string, prevRole: Role, nextRole: Role): Promise<void> {
  if (prevRole !== "ADMIN" || nextRole === "ADMIN") return;
  const others = await remainingAdminPeers(memberId);
  if (others >= 1) return;
  throw new AdminMutationError("last_admin_blocked");
}

export class AdminMutationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export const ADMIN_MUTATION_MESSAGES: Record<string, string> = {
  hr_role_guard:
    "Only CEO or Workspace Admin can assign or change Admin/CEO roles.",
  invalid_role_payload: "That role wasn’t recognized. Reload and try again.",
  invalid_status_payload: "That status wasn’t recognized. Reload and try again.",
  salary_create_blocked: "Salary wasn’t saved (needs CEO or Workspace Admin). Profile was created.",
  last_admin_blocked: "Can’t remove the last Workspace Admin — add or promote another Admin first.",
  invite_failed:
    "The onboarding email could not be sent (check RESEND / BREVO and NEXT_PUBLIC_APP_URL). Use Resend invite on the member’s edit page.",
  invite_resent: "A new onboarding email was sent.",
  missing_name_or_email: "First name, last name, and official email are required.",
  member_delete_forbidden: "Only CEO or Workspace Admin can permanently delete a member.",
  member_delete_self: "You can’t delete your own account from here.",
  member_delete_last_admin: "Can’t delete the last Workspace Admin — promote another Admin first.",
  member_delete_confirm_mismatch:
    "Confirmation email didn’t match this profile — nothing was deleted.",
  member_deleted: "Member record was permanently removed.",
  member_delete_failed:
    "Could not delete this member (database still references them). Try again or adjust related data.",
};
