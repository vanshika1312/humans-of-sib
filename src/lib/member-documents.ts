import type { AppViewer } from "@/lib/app-viewer";
import type { DocumentScope } from "@/generated/prisma";

export const DOCUMENT_ADMIN_ROLES = ["CEO", "ADMIN", "HR"] as const;

export function canManageAllDocuments(me: AppViewer | null): boolean {
  if (!me) return false;
  return (
    (DOCUMENT_ADMIN_ROLES as readonly string[]).includes(me.role) ||
    (me.permissions ?? []).includes("ADMIN_PANEL")
  );
}

export function canUploadDocument(
  me: AppViewer | null,
  args: { scope: DocumentScope; targetUserId: string },
): boolean {
  if (!me) return false;
  if (args.scope === "FOR_ALL") return canManageAllDocuments(me);
  if (args.targetUserId === me.id) return true;
  return canManageAllDocuments(me);
}

/** Personal files: the owner or HR/admin. Company-wide files: HR/admin only. */
export function canManageDocument(
  me: AppViewer | null,
  doc: { scope: DocumentScope; userId: string | null },
): boolean {
  if (!me) return false;
  if (canManageAllDocuments(me)) return true;
  return doc.scope === "PERSONAL" && doc.userId === me.id;
}
