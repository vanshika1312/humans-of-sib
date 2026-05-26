import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";

export const WIN_CERT_TEMPLATE_ID = "singleton";

export const WIN_CERT_STYLE_PRESETS = ["classic", "modern", "formal", "minimal"] as const;
export type WinCertStylePreset = (typeof WIN_CERT_STYLE_PRESETS)[number];

export const WIN_CERT_FONT_FAMILIES = ["serif", "sans", "mono"] as const;
export type WinCertFontFamily = (typeof WIN_CERT_FONT_FAMILIES)[number];

export type WinCertificateTemplateView = {
  title: string;
  subtitle: string;
  introText: string;
  recognitionPrefix: string;
  signatoryName: string;
  signatoryTitle: string;
  backgroundImageUrl: string | null;
  stylePreset: WinCertStylePreset;
  fontFamily: WinCertFontFamily;
  primaryColor: string;
  secondaryColor: string;
  backgroundFrom: string;
  backgroundTo: string;
  textColor: string;
  borderColor: string;
  updatedAt: string;
};

export const DEFAULT_WIN_CERT_TEMPLATE: Omit<WinCertificateTemplateView, "updatedAt"> = {
  title: "Certificate of Achievement",
  subtitle: "House of Skillinabox · HoS HRMS",
  introText: "This certificate is proudly awarded to",
  recognitionPrefix: "in recognition of",
  signatoryName: "CEO, Skillinabox",
  signatoryTitle: "Authorised Signatory",
  backgroundImageUrl: null,
  stylePreset: "classic",
  fontFamily: "serif",
  primaryColor: "#fbbf24",
  secondaryColor: "#fde68a",
  backgroundFrom: "#1e293b",
  backgroundTo: "#0f172a",
  textColor: "#e2e8f0",
  borderColor: "#fcd34d",
};

export const WIN_CERT_STYLE_LABELS: Record<WinCertStylePreset, string> = {
  classic: "Classic — trophy icon, gold accents",
  modern: "Modern — clean, left-aligned",
  formal: "Formal — double border, centered",
  minimal: "Minimal — simple, no icons",
};

export const WIN_CERT_FONT_LABELS: Record<WinCertFontFamily, string> = {
  serif: "Serif — traditional",
  sans: "Sans-serif — modern",
  mono: "Monospace — technical",
};

export function resolveWinCertFontFamily(fontFamily: WinCertFontFamily): string {
  switch (fontFamily) {
    case "sans":
      return 'var(--font-geist-sans), "Inter", system-ui, -apple-system, sans-serif';
    case "mono":
      return 'var(--font-geist-mono), ui-monospace, monospace';
    default:
      return 'Georgia, "Times New Roman", Times, serif';
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function winCertBackgroundStyle(template: WinCertificateTemplateView): CSSProperties {
  const rgb = hexToRgb(template.backgroundTo);
  const overlay = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.82)` : "rgba(15, 23, 42, 0.82)";
  const gradient = `linear-gradient(to bottom, ${template.backgroundFrom}, ${template.backgroundTo})`;

  if (template.backgroundImageUrl) {
    return {
      backgroundImage: `linear-gradient(${overlay}, ${overlay}), url(${template.backgroundImageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  return { backgroundImage: gradient };
}

export function winCertBorderStyle(template: WinCertificateTemplateView): CSSProperties {
  const preset = template.stylePreset;
  if (preset === "formal") {
    return {
      borderColor: template.borderColor,
      boxShadow: `inset 0 0 0 1px ${template.borderColor}40, inset 0 0 0 4px transparent, inset 0 0 0 5px ${template.borderColor}60`,
    };
  }
  return { borderColor: `${template.borderColor}99` };
}

export async function getWinCertificateTemplate(): Promise<WinCertificateTemplateView> {
  const row = await prisma.winCertificateTemplate.upsert({
    where: { id: WIN_CERT_TEMPLATE_ID },
    create: { id: WIN_CERT_TEMPLATE_ID, ...DEFAULT_WIN_CERT_TEMPLATE },
    update: {},
  });
  return {
    title: row.title,
    subtitle: row.subtitle,
    introText: row.introText,
    recognitionPrefix: row.recognitionPrefix,
    signatoryName: row.signatoryName,
    signatoryTitle: row.signatoryTitle,
    backgroundImageUrl: row.backgroundImageUrl,
    stylePreset: WIN_CERT_STYLE_PRESETS.includes(row.stylePreset as WinCertStylePreset)
      ? (row.stylePreset as WinCertStylePreset)
      : "classic",
    fontFamily: WIN_CERT_FONT_FAMILIES.includes(row.fontFamily as WinCertFontFamily)
      ? (row.fontFamily as WinCertFontFamily)
      : "serif",
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    backgroundFrom: row.backgroundFrom,
    backgroundTo: row.backgroundTo,
    textColor: row.textColor,
    borderColor: row.borderColor,
    updatedAt: row.updatedAt.toISOString(),
  };
}
