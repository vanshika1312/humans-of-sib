import { notFound, redirect } from "next/navigation";
import { requireAppViewer } from "@/lib/app-viewer";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { displayName } from "@/lib/user-display-name";
import { getWinCertificateTemplate } from "@/lib/win-certificate-template";
import { TrainingCertificateDisplay } from "@/components/training/training-certificate-display";
import { TRAINING_TYPE_LABEL } from "@/lib/training-admin";
import { PrintOnLoad } from "@/app/(app)/wins/certificates/[certId]/print/_components/PrintOnLoad";

type Props = { params: Promise<{ certId: string }> };

export default async function TrainingCertificatePrintPage({ params }: Props) {
  const me = await requireAppViewer();
  if (!me) redirect("/sign-in");

  const { certId } = await params;
  const cert = await prisma.certificate.findUnique({
    where: { id: certId },
    include: {
      user: { select: { id: true, name: true, firstName: true, lastName: true } },
      training: { select: { title: true, type: true } },
    },
  });
  if (!cert) notFound();
  if (cert.userId !== me.id && !["CEO", "ADMIN", "HR"].includes(me.role)) {
    return (
      <div className="p-8 text-center text-sm text-ink-600">
        You can only print your own certificates.
      </div>
    );
  }

  const template = await getWinCertificateTemplate();
  const issuedLabel = formatDate(cert.issuedAt, { month: "long", year: "numeric" });
  const typeLabel = TRAINING_TYPE_LABEL[cert.training.type] ?? cert.training.type;

  return (
    <div className="min-h-screen bg-white p-6 print:p-0 print:min-h-0">
      <PrintOnLoad />
      <p className="text-center text-xs text-ink-500 mb-4 print:hidden">
        Use your browser&apos;s print dialog and choose &quot;Save as PDF&quot; to download.
      </p>
      <div className="max-w-3xl mx-auto print:max-w-none certificate-print-root">
        <TrainingCertificateDisplay
          template={template}
          recipientName={displayName(cert.user)}
          trainingTitle={cert.training.title}
          trainingTypeLabel={typeLabel}
          issuedLabel={issuedLabel}
          certNumber={cert.number}
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
