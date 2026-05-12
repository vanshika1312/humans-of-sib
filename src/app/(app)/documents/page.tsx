import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FileText, Download } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  OFFER_LETTER: "Offer Letter",
  APPOINTMENT_LETTER: "Appointment Letter",
  APPRECIATION: "Appreciation",
  PAYSLIP: "Payslip",
  FORM_16: "Form 16",
  ID_PROOF: "ID Proof",
  ADDRESS_PROOF: "Address Proof",
  NDA: "NDA",
  ESOP: "ESOP",
  POLICY: "Policy",
  CERTIFICATE: "Certificate",
  OTHER: "Other",
};

const TYPE_EMOJI: Record<string, string> = {
  OFFER_LETTER: "📄",
  APPOINTMENT_LETTER: "📋",
  APPRECIATION: "💌",
  PAYSLIP: "💸",
  FORM_16: "📊",
  ID_PROOF: "🆔",
  ADDRESS_PROOF: "🏠",
  NDA: "🔒",
  ESOP: "📈",
  POLICY: "📖",
  CERTIFICATE: "🏅",
  OTHER: "📎",
};

export default function DocumentsPage() {
  return (
    <div>
      <PageHeader title="My Documents" emoji="📂" subtitle="All your HR paperwork — in one place." />
      <Suspense fallback={<RouteBodyFallback />}>
        <DocumentsPageBody />
      </Suspense>
    </div>
  );
}

async function DocumentsPageBody() {
  const me = await requireAppViewer();
  if (!me) return null;

  const docs = await prisma.document.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
  });

  const byType = docs.reduce<Record<string, typeof docs>>((acc, d) => {
    (acc[d.type] ||= []).push(d);
    return acc;
  }, {});

  return (
    <>
      {docs.length === 0 ? (
        <EmptyState
          emoji="📂"
          title="No documents yet"
          description="HR will upload your offer letter, payslips, and more here. Ping hr@skillinabox.in if you need something."
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(byType).map(([type, items]) => (
            <div key={type}>
              <h2 className="text-sm font-semibold text-ink-600 mb-2 flex items-center gap-2">
                <span>{TYPE_EMOJI[type]}</span> {TYPE_LABEL[type]}
                <Badge tone="ink">{items.length}</Badge>
              </h2>
              <Card>
                <CardContent className="pt-4">
                  <ul className="divide-y divide-ink-100">
                    {items.map((d) => (
                      <li key={d.id} className="py-3 flex items-center gap-3">
                        <FileText className="size-5 text-ink-400" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink-700 truncate">{d.title}</div>
                          <div className="text-xs text-ink-400">Uploaded {formatDate(d.createdAt)}</div>
                        </div>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100"
                        >
                          <Download className="size-3.5" /> Open
                        </a>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
