"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  emailWinCertificate,
  shareWinCertificateOnWall,
  type WinCertActionResult,
} from "../actions";

const CERT_ACTION_INIT: WinCertActionResult = { ok: true };

type Props = {
  certId: string | undefined;
  canAct: boolean;
  alreadyOnWall: boolean;
};

export function WinCertificateActions({ certId, canAct, alreadyOnWall }: Props) {
  const [emailResult, emailDispatch, emailPending] = useActionState(
    emailWinCertificate,
    CERT_ACTION_INIT,
  );
  const [shareResult, shareDispatch, sharePending] = useActionState(
    shareWinCertificateOnWall,
    CERT_ACTION_INIT,
  );

  const disabled = !certId || !canAct;
  const printUrl = certId ? `/wins/certificates/${certId}/print` : null;

  function handleDownload() {
    if (!printUrl) return;
    window.open(printUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="grid sm:grid-cols-3 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={handleDownload}
        >
          Download PDF
        </Button>

        <form action={emailDispatch}>
          <input type="hidden" name="certId" value={certId ?? ""} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={disabled || emailPending}
          >
            {emailPending ? "Sending…" : "Email to member"}
          </Button>
        </form>

        <form action={shareDispatch}>
          <input type="hidden" name="certId" value={certId ?? ""} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={disabled || sharePending || alreadyOnWall}
          >
            {sharePending ? "Sharing…" : alreadyOnWall ? "On win wall" : "Share on wall"}
          </Button>
        </form>
      </div>

      <ActionFeedback result={emailResult} />
      <ActionFeedback result={shareResult} />
      {disabled && !certId && (
        <p className="text-[11px] text-ink-400 text-center">Issue a certificate to enable these actions.</p>
      )}
    </div>
  );
}

function ActionFeedback({ result }: { result: WinCertActionResult }) {
  if (!result.ok && result.error) {
    return <p className="text-sm text-red-600 text-center">{result.error}</p>;
  }
  if (result.ok && result.message) {
    return (
      <p
        className={`text-sm text-center ${
          result.alreadyShared ? "text-ink-500" : "text-emerald-700"
        }`}
      >
        {result.message}
      </p>
    );
  }
  return null;
}
