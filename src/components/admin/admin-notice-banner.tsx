import { ADMIN_MUTATION_MESSAGES } from "@/lib/admin-mutations";

export function AdminNoticeBanner({ code }: { code?: string }) {
  if (!code) return null;
  const msg = ADMIN_MUTATION_MESSAGES[code];
  if (!msg) return null;

  const isSoft = ["salary_create_blocked", "invite_failed", "invite_resent"].includes(code);

  return (
    <div
      className={
        isSoft
          ? "mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          : "mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      }
    >
      {msg}
    </div>
  );
}
