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
