import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveWinCertFontFamily,
  winCertBackgroundStyle,
  winCertBorderStyle,
  type WinCertificateTemplateView,
} from "@/lib/win-certificate-template";

export function WinCertificateDisplay({
  template,
  recipientName,
  achievement,
  issuedLabel,
  certNumber,
  compact,
  className,
}: {
  template: WinCertificateTemplateView;
  recipientName: string;
  achievement: string;
  issuedLabel: string;
  certNumber?: string;
  compact?: boolean;
  className?: string;
}) {
  const fontFamily = resolveWinCertFontFamily(template.fontFamily);
  const preset = template.stylePreset;
  const showIcon = preset === "classic" || preset === "formal";
  const isModern = preset === "modern";
  const isFormal = preset === "formal";
  const isMinimal = preset === "minimal";

  const mutedText = `${template.textColor}99`;
  const dividerColor = `${template.primaryColor}4d`;

  return (
    <div
      className={cn(
        "border-2 text-center shadow-lg",
        isModern && "rounded-lg text-left",
        isFormal && "rounded-none border-4 p-8 sm:p-12",
        isMinimal && "rounded-md border shadow-sm",
        !isModern && !isFormal && !isMinimal && "rounded-2xl",
        compact ? "p-4 sm:p-6" : isFormal ? "" : "p-6 sm:p-10",
        className,
      )}
      style={{
        ...winCertBackgroundStyle(template),
        ...winCertBorderStyle(template),
        color: template.textColor,
        fontFamily,
      }}
    >
      {showIcon && (
        <Trophy
          className={cn("mx-auto mb-4", compact ? "size-8" : "size-10", isModern && "hidden")}
          style={{ color: template.primaryColor }}
          aria-hidden
        />
      )}

      <p
        className={cn(
          compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl",
          isFormal && "tracking-wide uppercase",
          isModern && "text-left",
        )}
        style={{ color: template.secondaryColor }}
      >
        {template.title}
      </p>
      <p
        className={cn("text-xs mt-1", isModern && "text-left")}
        style={{ color: mutedText }}
      >
        {template.subtitle}
      </p>

      <div
        className={cn(
          "my-6 border-t",
          isMinimal && "my-4",
          isFormal && "my-8 max-w-xs mx-auto",
        )}
        style={{ borderColor: dividerColor }}
      />

      <p
        className={cn(
          "text-sm max-w-lg leading-relaxed",
          isModern ? "mx-0 text-left" : "mx-auto",
        )}
      >
        {template.introText}{" "}
        <span
          className={cn(
            "block text-xl sm:text-2xl mt-2 mb-2",
            isFormal && "text-3xl sm:text-4xl tracking-wide",
          )}
          style={{ color: template.secondaryColor }}
        >
          {recipientName}
        </span>
        {template.recognitionPrefix}{" "}
        <span style={{ color: template.secondaryColor, opacity: 0.9 }}>{achievement}</span>
      </p>

      <div
        className={cn(
          "mt-8 flex flex-wrap gap-6 text-left text-xs max-w-md",
          isModern ? "mx-0 justify-start" : "mx-auto justify-between",
          isFormal && "max-w-lg",
        )}
        style={{ color: mutedText }}
      >
        <div>
          <div style={{ color: template.textColor }} className="font-medium">
            {template.signatoryName}
          </div>
          <div>{template.signatoryTitle}</div>
          <div
            className="mt-4 border-t w-32"
            style={{ borderColor: `${template.textColor}40` }}
          />
        </div>
        {(preset === "classic" || preset === "formal") && (
          <div
            className="text-2xl self-center"
            style={{ color: template.primaryColor }}
            aria-hidden
          >
            ★
          </div>
        )}
        <div className={cn(isModern ? "text-left" : "text-right")}>
          <div>Issued: {issuedLabel}</div>
          {certNumber ? (
            <div className="font-mono mt-1" style={{ color: `${template.textColor}cc` }}>
              Cert ID: {certNumber}
            </div>
          ) : (
            <div className="font-mono mt-1" style={{ color: `${template.textColor}66` }}>
              Cert ID: HOS-WIN-…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
