import { Suspense } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { canManageLiaKnowledge } from "@/lib/lia-admin";
import { getLiaCoreDocument } from "@/lib/lia-core-documents";
import { firstSearchParam } from "@/lib/search-param";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { updateLiaDocument } from "../../actions";
import { LiaPolicyFileField } from "../../_components/lia-policy-file-field";

const UPLOAD_ERRORS: Record<string, string> = {
  invalid: "Check required fields and try again.",
  "upload-too-large": "File is too large (max 12 MB).",
  "upload-unsupported": "Use PDF, DOC, or DOCX.",
};

export default function AdminLiaDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string | string[]; error?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <AdminLiaDocumentPageInner params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminLiaDocumentPageInner({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string | string[]; error?: string | string[] }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const saved = firstSearchParam(sp.saved) === "1";
  const errorKey = firstSearchParam(sp.error);
  const errorMessage = errorKey ? UPLOAD_ERRORS[errorKey] ?? "Could not save." : null;

  const me = await requireAppViewer();
  if (!canManageLiaKnowledge(me)) redirect("/home");

  const article = await prisma.liaKnowledgeArticle.findUnique({ where: { slug } });
  if (!article || article.kind !== "DOCUMENT") redirect("/admin/lia?tab=documents");

  const def = getLiaCoreDocument(slug);
  const subtitle = def?.adminHint ?? "Standard policy for all members — upload the official PDF and keep the summary in sync.";

  return (
    <div>
      <PageHeader
        title={article.title}
        emoji="📄"
        subtitle={subtitle}
        action={
          <Link href="/admin/lia?tab=documents">
            <Button variant="outline">All documents</Button>
          </Link>
        }
      />
      {saved ? (
        <p className="mb-4 text-sm text-emerald-700 font-medium">Saved.</p>
      ) : null}
      {errorMessage ? (
        <p className="mb-4 text-sm text-red-700 font-medium">{errorMessage}</p>
      ) : null}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge tone="ink">{article.category}</Badge>
            <Badge tone="ink">{slug}</Badge>
            {article.published ? <Badge tone="green">Live</Badge> : <Badge tone="ink">Draft</Badge>}
            {article.detailUrl ? <Badge tone="sky">Document attached</Badge> : null}
          </div>
          <form
            action={updateLiaDocument.bind(null, slug)}
            encType="multipart/form-data"
            className="space-y-4 max-w-2xl"
          >
            <LiaPolicyFileField detailUrl={article.detailUrl} />
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={article.title} required />
            </div>
            <div>
              <Label htmlFor="summary">Summary</Label>
              <p className="text-xs text-ink-400 mb-1">
                Short answer LIA gives members — keep factual and aligned with the body below.
              </p>
              <Textarea id="summary" name="summary" rows={4} defaultValue={article.summary} required />
            </div>
            <div>
              <Label htmlFor="body">Full policy text</Label>
              <p className="text-xs text-ink-400 mb-1">
                Retrieved when members ask detailed questions. Use clear bullets and headings.
              </p>
              <Textarea id="body" name="body" rows={14} defaultValue={article.body} required />
            </div>
            <div>
              <Label htmlFor="detailHref">In-app link (optional)</Label>
              <Input
                id="detailHref"
                name="detailHref"
                defaultValue={article.detailHref ?? def?.detailHref ?? ""}
                placeholder="/attendance?tab=requests"
              />
            </div>
            <div>
              <Label htmlFor="detailUrl">External handbook / Google Doc (optional)</Label>
              <p className="text-xs text-ink-400 mb-1">
                Use this if the canonical doc lives on Drive or the web instead of an upload.
              </p>
              <Input
                id="detailUrl"
                name="detailUrl"
                defaultValue={article.detailUrl ?? ""}
                placeholder="https://docs.google.com/…"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-600">
              <input type="checkbox" name="published" defaultChecked={article.published} className="rounded" />{" "}
              Published (LIA can use this document)
            </label>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" variant="accent">
                Save document
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
