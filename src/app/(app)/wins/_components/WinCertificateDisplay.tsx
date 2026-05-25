import { Trophy } from "lucide-react";
import type { WinCertificateTemplateView } from "@/lib/win-certificate-template";

export function WinCertificateDisplay({
  template,
  recipientName,
  achievement,
  issuedLabel,
  certNumber,
}: {
  template: WinCertificateTemplateView;
  recipientName: string;
  achievement: string;
  issuedLabel: string;
  certNumber?: string;
}) {
  const bgStyle = template.backgroundImageUrl
    ? {
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.72), rgba(15, 23, 42, 0.88)), url(${template.backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <div
      className="rounded-2xl border-2 border-amber-300/60 bg-gradient-to-b from-ink-800 to-ink-900 p-6 sm:p-10 text-center text-white shadow-lg"
      style={bgStyle}
    >
      <Trophy className="size-10 text-amber-400 mx-auto mb-4" aria-hidden />
      <p className="font-serif text-2xl sm:text-3xl text-amber-200">{template.title}</p>
      <p className="text-xs text-ink-300 mt-1">{template.subtitle}</p>
      <div className="my-6 border-t border-amber-500/30" />
      <p className="text-sm text-ink-200 max-w-lg mx-auto leading-relaxed">
        {template.introText}{" "}
        <span className="block text-xl sm:text-2xl font-serif text-amber-200 mt-2 mb-2">
          {recipientName}
        </span>
        {template.recognitionPrefix}{" "}
        <span className="font-serif text-amber-100">{achievement}</span>
      </p>
      <div className="mt-8 flex flex-wrap justify-between gap-6 text-left text-xs text-ink-400 max-w-md mx-auto">
        <div>
          <div className="text-ink-200 font-medium">{template.signatoryName}</div>
          <div>{template.signatoryTitle}</div>
          <div className="mt-4 border-t border-ink-600 w-32" />
        </div>
        <div className="text-amber-400 text-2xl self-center" aria-hidden>
          ★
        </div>
        <div className="text-right">
          <div>Issued: {issuedLabel}</div>
          {certNumber ? (
            <div className="font-mono text-ink-300 mt-1">Cert ID: {certNumber}</div>
          ) : (
            <div className="font-mono text-ink-500 mt-1">Cert ID: HOS-WIN-…</div>
          )}
        </div>
      </div>
    </div>
  );
}
