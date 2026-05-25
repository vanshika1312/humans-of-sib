import { notFound, redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { canAwardWins } from "@/lib/win-wall-access";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { getWinCertificateTemplate } from "@/lib/win-certificate-template";
import { WinCertificateDisplay } from "@/app/(app)/wins/_components/WinCertificateDisplay";
import { PrintOnLoad } from "./_components/PrintOnLoad";

type Props = { params: Promise<{ certId: string }> };

export default async function WinCertificatePrintPage({ params }: Props) {
  const me = await requireAppViewer();
  if (!me) redirect("/login");

  if (!canAwardWins(me.role)) {
    return (
      <div className="p-8 text-center text-sm text-ink-600">
        You do not have permission to print certificates.
      </div>
    );
  }

  const { certId } = await params;
  const cert = await prisma.winCertificate.findUnique({
    where: { id: certId },
    include: { user: { select: { name: true } } },
  });
  if (!cert) notFound();

  const template = await getWinCertificateTemplate();
  const issuedLabel = formatDate(cert.issuedAt, { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-white p-6 print:p-0 print:min-h-0">
      <PrintOnLoad />
      <p className="text-center text-xs text-ink-500 mb-4 print:hidden">
        Use your browser&apos;s print dialog and choose &quot;Save as PDF&quot; to download.
      </p>
      <div className="max-w-3xl mx-auto print:max-w-none certificate-print-root">
        <WinCertificateDisplay
          template={template}
          recipientName={cert.user.name ?? "Team member"}
          achievement={cert.achievement}
          issuedLabel={issuedLabel}
          certNumber={cert.certNumber}
        />
      </div>
      <style>{`
        @media print {
          body { background: white !important; }
          .certificate-print-root * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
