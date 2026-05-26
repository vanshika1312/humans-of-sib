import Link from "next/link";
import { Label } from "@/components/ui/input";
import { isLiaStoredPolicyFileUrl } from "@/lib/lia-detail-url";

type Props = {
  detailUrl: string | null;
  idPrefix?: string;
};

export function LiaPolicyFileField({ detailUrl, idPrefix = "policy" }: Props) {
  const fileId = `${idPrefix}-file`;
  const clearId = `${idPrefix}-clear`;

  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4 space-y-3">
      <div>
        <Label htmlFor={fileId}>Official document file (PDF, DOC, DOCX)</Label>
        <p className="text-xs text-ink-400 mt-1 mb-2">
          Upload once — all members get this link when LIA cites the policy (max 12 MB). Overrides the
          external URL below when a new file is chosen.
        </p>
        <input
          id={fileId}
          name="policyFile"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-sky-900 hover:file:bg-sky-200"
        />
      </div>
      {detailUrl ? (
        <div className="text-sm text-ink-600 space-y-2">
          <p>
            Current file:{" "}
            <Link href={detailUrl} className="text-sky-700 font-medium hover:underline" target="_blank" rel="noopener noreferrer">
              Open document
            </Link>
            {isLiaStoredPolicyFileUrl(detailUrl) ? (
              <span className="text-ink-400"> (uploaded)</span>
            ) : (
              <span className="text-ink-400"> (external link)</span>
            )}
          </p>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            <input id={clearId} name="clearPolicyFile" type="checkbox" className="rounded" />
            Remove file / link
          </label>
        </div>
      ) : null}
    </div>
  );
}
