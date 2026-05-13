import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { requireAppViewer } from "@/lib/app-viewer";
import { BulkResumeImportClient, type SerializedImportBatch } from "../_components/bulk-resume-import-client";

const RECRUITER_ROLES = ["CEO", "ADMIN", "HR"];

type Props = {
  searchParams: Promise<{ batch?: string | string[] }>;
};

export default async function BulkResumeImportPage(props: Props) {
  const me = await requireAppViewer();
  if (!me || !RECRUITER_ROLES.includes(me.role)) redirect("/home");

  const sp = await props.searchParams;
  const batchParam = typeof sp.batch === "string" ? sp.batch : undefined;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const webhookBaseUrl = host ? `${proto}://${host}` : "";

  const openJobs = await prisma.hiringJob.findMany({
    where: { status: "OPEN" },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  let initialBatch: SerializedImportBatch | null = null;

  if (batchParam) {
    const batch = await prisma.hiringResumeImportBatch.findFirst({
      where: {
        id: batchParam,
        expiresAt: { gt: new Date() },
      },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    if (!batch) {
      redirect("/hiring/applications/import");
    }

    if (batch.sourceChannel === "UPLOAD" && batch.createdById !== me.id) {
      redirect("/hiring/applications/import");
    }

    initialBatch = {
      id: batch.id,
      sourceChannel: batch.sourceChannel,
      applicationSource: batch.applicationSource,
      targetJobId: batch.targetJobId,
      expiresAt: batch.expiresAt.toISOString(),
      revision: batch.items.map((i) => `${i.id}:${i.status}`).join("|"),
      items: batch.items.map((it) => ({
        id: it.id,
        fileName: it.fileName,
        resumeUrl: it.resumeUrl,
        status: it.status,
        error: it.error,
        parsedPayloadJson: it.parsedPayloadJson,
      })),
    };
  }

  return (
    <div className="space-y-8 pb-10 max-w-6xl">
      <PageHeader
        title="Bulk résumé import"
        emoji="📤"
        subtitle="Upload multiple résumés, review parsed fields, then create candidates linked to one open posting."
        action={
          <div className="flex flex-col gap-2 items-end">
            <Link href="/hiring/applications">
              <Button variant="outline" size="md">
                Applications →
              </Button>
            </Link>
          </div>
        }
      />

      <BulkResumeImportClient
        key={`${initialBatch?.id ?? "new"}:${initialBatch?.revision ?? ""}`}
        openJobs={openJobs}
        initialBatch={initialBatch}
        webhookBaseUrl={webhookBaseUrl}
      />
    </div>
  );
}
