export const PERMISSIONS = [
  /**
   * Can view anyone’s personal task board (beyond manager / dept head rules).
   * Useful for CEO/Admin or explicitly delegated HR.
   */
  "TASKS_VIEW_ALL",

  /** Can open `/admin` (read-only unless coupled with write permissions). */
  "ADMIN_PANEL",

  /** Can create/update team members via Admin panel. */
  "ADMIN_TEAM_WRITE",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const PERMISSION_SET = new Set<string>(PERMISSIONS);

export function isPermission(raw: unknown): raw is Permission {
  return typeof raw === "string" && PERMISSION_SET.has(raw);
}

export function normalizePermissions(raw: unknown[]): Permission[] {
  const out: Permission[] = [];
  for (const r of raw) {
    if (!isPermission(r)) continue;
    if (!out.includes(r)) out.push(r);
  }
  return out;
}

export function hasPermission(
  user: { permissions?: string[] | null } | null | undefined,
  permission: Permission,
): boolean {
  const list = user?.permissions ?? [];
  return Array.isArray(list) && list.includes(permission);
}

