import { ADMIN_MUTATION_MESSAGES } from "@/lib/admin-mutations";

export function AdminNoticeBanner({ code, detail }: { code?: string; detail?: string }) {
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
      <div>{msg}</div>
      {code === "invite_failed" && detail && (
        <pre className="mt-2 text-xs whitespace-pre-wrap break-words text-amber-900/90 font-mono border border-amber-200/80 rounded-md p-2 bg-white/60 max-h-48 overflow-y-auto">
          {detail}
        </pre>
      )}
      {code === "invite_failed" && !detail && (
        <div className="mt-2 text-xs text-amber-900/85 space-y-1 border border-amber-200/80 rounded-md p-2 bg-white/60">
          <p className="font-medium">No API detail was returned — check the terminal where you run `next dev` for the line:</p>
          <p className="font-mono">[Humans of SIB] onboarding invite email failed</p>
          <ul className="list-disc pl-4 pt-1 space-y-0.5">
            <li>
              <code className="text-[11px]">EMAIL_PROVIDER=brevo</code> and <code className="text-[11px]">BREVO_API_KEY</code> are set; restart the dev server after editing <code className="text-[11px]">.env.local</code>.
            </li>
            <li>
              In Brevo, the address in <code className="text-[11px]">EMAIL_FROM</code> must be a <strong>verified sender</strong> (same email).
            </li>
            <li>Confirm the API key has permission to send transactional email.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
