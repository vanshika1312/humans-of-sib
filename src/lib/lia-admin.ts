import type { AppViewer } from "@/lib/app-viewer";

const ADMIN_ROLES = ["CEO", "ADMIN", "HR"];

export function canManageLiaKnowledge(me: AppViewer | null): boolean {
  if (!me) return false;
  return ADMIN_ROLES.includes(me.role) || (me.permissions ?? []).includes("ADMIN_PANEL");
}
