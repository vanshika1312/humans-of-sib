import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { canManageAllDocuments } from "@/lib/member-documents";
import { firstSearchParam } from "@/lib/search-param";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FileText, Download } from "lucide-react";
import type { Document } from "@/generated/prisma";
import {
  DocumentUploadDialog,
  type DocumentUploadMember,
} from "./_components/document-upload-dialog";

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

const UPLOAD_ERRORS: Record<string, string> = {
  invalid: "Check the form fields and try again.",
  forbidden: "You don't have permission to upload this document.",
  "invalid-member": "Select a valid active team member.",
  "upload-too-large": "File is too large (max 12 MB).",
  "upload-empty": "Choose a file to upload.",
  "upload-unsupported": "Use PDF, DOC, or DOCX.",
};

type SearchParams = Promise<{
  uploaded?: string | string[];
  error?: string | string[];
  warn?: string | string[];
}>;

export default function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div>
      <Suspense fallback={<RouteBodyFallback />}>
        <DocumentsPageWithFlash searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function DocumentsPageWithFlash({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const uploaded = firstSearchParam(sp.uploaded);
  const error = firstSearchParam(sp.error);
  const warn = firstSearchParam(sp.warn);

  return (
    <>
      {uploaded === "1" ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Document uploaded successfully.
          {warn === "lia-no-text" ? (
            <p className="mt-2 text-emerald-900/90">
              LIA could not read text from this PDF (it may be scanned). The file is saved; HR can paste
              policy text under Admin → LIA or upload a text-based PDF.
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {UPLOAD_ERRORS[error] ?? "Something went wrong. Please try again."}
        </div>
      ) : null}
      <PageHeader
        title="My Documents"
        emoji="📂"
        subtitle="Your HR paperwork and company-wide files. Upload personal documents anytime; HR can share files for everyone."
        action={
          <Suspense fallback={null}>
            <DocumentsUploadTrigger />
          </Suspense>
        }
      />
      <Suspense fallback={<RouteBodyFallback />}>
        <DocumentsPageBody />
      </Suspense>
    </>
  );
}

async function DocumentsUploadTrigger() {
  const me = await requireAppViewer();
  if (!me) return null;

  const canManage = canManageAllDocuments(me);
  let members: DocumentUploadMember[] = [];

  if (canManage) {
    members = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, firstName: true, lastName: true, email: true, title: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <DocumentUploadDialog
      canManageAllDocuments={canManage}
      currentUserId={me.id}
      members={members}
    />
  );
}

async function DocumentsPageBody() {
  const me = await requireAppViewer();
  if (!me) return null;

  const canManage = canManageAllDocuments(me);

  const [docs, members] = await Promise.all([
    prisma.document.findMany({
      where: {
        OR: [{ scope: "FOR_ALL" }, { scope: "PERSONAL", userId: me.id }],
      },
      orderBy: { createdAt: "desc" },
    }),
    canManage
      ? prisma.user.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, firstName: true, lastName: true, email: true, title: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as DocumentUploadMember[]),
  ]);

  const forAll = docs.filter((d) => d.scope === "FOR_ALL");
  const personal = docs.filter((d) => d.scope === "PERSONAL");

  const uploadControl = (
    <DocumentUploadDialog
      canManageAllDocuments={canManage}
      currentUserId={me.id}
      members={members}
      variant="outline"
    />
  );

  if (docs.length === 0) {
    return (
      <EmptyState
        emoji="📂"
        title="No documents yet"
        description="Upload your own files here, or ask HR to add offer letters, payslips, and company-wide policies. Ping hr@skillinabox.in if you need something."
        action={uploadControl}
      />
    );
  }

  return (
    <div className="space-y-8">
      <DocumentScopeSection
        heading="For everyone"
        description="Shared with the whole organisation."
        docs={forAll}
        emptyHint="No company-wide documents yet."
      />
      <DocumentScopeSection
        heading="Personal"
        description="Visible only to you."
        docs={personal}
        emptyHint="No personal documents yet."
      />
    </div>
  );
}

function DocumentScopeSection({
  heading,
  description,
  docs,
  emptyHint,
}: {
  heading: string;
  description: string;
  docs: Document[];
  emptyHint: string;
}) {
  const byType = docs.reduce<Record<string, Document[]>>((acc, d) => {
    (acc[d.type] ||= []).push(d);
    return acc;
  }, {});

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-semibold text-ink-700">{heading}</h2>
        <p className="text-sm text-ink-400">{description}</p>
      </div>
      {docs.length === 0 ? (
        <p className="text-sm text-ink-400 rounded-xl border border-dashed border-ink-200 bg-white px-4 py-8 text-center">
          {emptyHint}
        </p>
      ) : (
        <div className="space-y-5">
          {Object.entries(byType).map(([type, items]) => (
            <div key={type}>
              <h3 className="text-sm font-semibold text-ink-600 mb-2 flex items-center gap-2">
                <span>{TYPE_EMOJI[type]}</span> {TYPE_LABEL[type]}
                <Badge tone="ink">{items.length}</Badge>
              </h3>
              <Card>
                <CardContent className="pt-4">
                  <ul className="divide-y divide-ink-100">
                    {items.map((d) => (
                      <li key={d.id} className="py-3 flex items-center gap-3">
                        <FileText className="size-5 text-ink-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink-700 truncate">{d.title}</div>
                          <div className="text-xs text-ink-400">Uploaded {formatDate(d.createdAt)}</div>
                        </div>
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 shrink-0"
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
    </section>
  );
}
