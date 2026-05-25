import { prisma } from "@/lib/prisma";

export const WIN_CERT_TEMPLATE_ID = "singleton";

export type WinCertificateTemplateView = {
  title: string;
  subtitle: string;
  introText: string;
  recognitionPrefix: string;
  signatoryName: string;
  signatoryTitle: string;
  backgroundImageUrl: string | null;
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
};

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
    updatedAt: row.updatedAt.toISOString(),
  };
}
