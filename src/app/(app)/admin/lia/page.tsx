import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { canManageLiaKnowledge } from "@/lib/lia-admin";
import { LIA_CORE_DOCUMENTS, LIA_CORE_DOCUMENT_SLUGS } from "@/lib/lia-core-documents";
import { firstSearchParam } from "@/lib/search-param";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, ChevronRight } from "lucide-react";
import {
  backfillOrgPolicyDocumentsForLia,
  createLiaArticle,
  createLiaStandardDocument,
  ensureLiaCoreDocument,
} from "./actions";
import { Label, Input, Textarea, Select } from "@/components/ui/input";
import { LiaAdminTabs, type LiaAdminTab } from "./_components/lia-admin-tabs";
import { LiaPolicyFileField } from "./_components/lia-policy-file-field";

const CATEGORIES = ["LEAVE", "ATTENDANCE", "PULSE", "GENERAL", "BENEFITS", "CULTURE"] as const;

export default function AdminLiaPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[];
    error?: string | string[];
    backfill?: string | string[];
    backfillSkipped?: string | string[];
    backfillErrors?: string | string[];
  }>;
}) {
  return (
    <div>
      <PageHeader
        title="LIA knowledge base"
        emoji="✨"
        subtitle="Core policy documents and short articles LIA uses to answer members."
        action={
          <Link href="/admin">
            <Button variant="outline">Admin home</Button>
          </Link>
        }
      />
      <Suspense fallback={<RouteBodyFallback />}>
        <AdminLiaPageBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AdminLiaPageBody({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string | string[];
    error?: string | string[];
    backfill?: string | string[];
    backfillSkipped?: string | string[];
    backfillErrors?: string | string[];
  }>;
}) {
  const me = await requireAppViewer();
  if (!canManageLiaKnowledge(me)) redirect("/home");

  const sp = await searchParams;
  const tabRaw = firstSearchParam(sp.tab);
  const tab: LiaAdminTab = tabRaw === "articles" ? "articles" : "documents";
  const backfillSynced = firstSearchParam(sp.backfill);
  const backfillSkipped = firstSearchParam(sp.backfillSkipped);
  const backfillHadErrors = firstSearchParam(sp.backfillErrors);
  const docError = firstSearchParam(sp.error);
  const docErrorMessage =
    docError === "slug-taken"
      ? "That slug is already in use."
      : docError === "upload"
        ? "Could not upload — use PDF, DOC, or DOCX under 12 MB."
        : docError === "invalid"
          ? "Check the new document form and try again."
          : null;

  const [documents, articles] = await Promise.all([
    prisma.liaKnowledgeArticle.findMany({
      where: { kind: "DOCUMENT" },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    prisma.liaKnowledgeArticle.findMany({
      where: { kind: "ARTICLE" },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
  ]);

  const documentBySlug = new Map(documents.map((d) => [d.slug, d]));
  const customDocuments = documents.filter((d) => !LIA_CORE_DOCUMENT_SLUGS.has(d.slug));

  return (
    <>
      <LiaAdminTabs active={tab} />

      {tab === "documents" ? (
        <div className="space-y-8">
          {docErrorMessage ? (
            <p className="text-sm text-red-700 font-medium">{docErrorMessage}</p>
          ) : null}
          {backfillSynced !== null ? (
            <p className="text-sm text-emerald-800 font-medium">
              Synced {backfillSynced} company policy document(s) from Documents into LIA
              {backfillSkipped && backfillSkipped !== "0"
                ? ` (${backfillSkipped} skipped)`
                : ""}
              .
              {backfillHadErrors ? " Some files could not be read — check server logs or re-upload." : ""}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-500 max-w-2xl">
              Standard policies for every member (leave, CoC, etc.). Edit the summary and retrieval text,
              then upload the official PDF or link to the full handbook. Company-wide{" "}
              <strong className="font-medium text-ink-700">Policy</strong> uploads on{" "}
              <Link href="/documents" className="text-sky-700 underline">
                Documents
              </Link>{" "}
              are indexed into LIA automatically; core slugs here remain the canonical editor for built-in
              topics.
            </p>
            <form action={backfillOrgPolicyDocumentsForLia}>
              <Button type="submit" variant="outline" size="sm">
                Sync Documents policies → LIA
              </Button>
            </form>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {LIA_CORE_DOCUMENTS.map((def) => {
              const row = documentBySlug.get(def.slug);
              return (
                <Card key={def.slug} className="overflow-hidden">
                  <CardContent className="p-0">
                    {row ? (
                      <Link
                        href={`/admin/lia/documents/${def.slug}`}
                        className="flex items-start gap-3 p-5 hover:bg-ink-50 transition-colors"
                      >
                        <FileText className="size-5 text-sky-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-ink-700">{row.title}</div>
                          <p className="text-sm text-ink-500 mt-1 line-clamp-2">{def.adminHint}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            <Badge tone="ink">{row.category}</Badge>
                            {row.published ? (
                              <Badge tone="green">Live</Badge>
                            ) : (
                              <Badge tone="ink">Draft</Badge>
                            )}
                            {row.detailUrl ? <Badge tone="sky">Doc attached</Badge> : null}
                          </div>
                        </div>
                        <ChevronRight className="size-5 text-ink-300 shrink-0" />
                      </Link>
                    ) : (
                      <div className="p-5">
                        <div className="flex items-start gap-3">
                          <FileText className="size-5 text-ink-300 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-ink-700">{def.title}</div>
                            <p className="text-sm text-ink-500 mt-1">{def.adminHint}</p>
                            <p className="text-xs text-amber-700 mt-2">Not in database yet.</p>
                          </div>
                        </div>
                        <form action={ensureLiaCoreDocument.bind(null, def.slug)} className="mt-4">
                          <Button type="submit" variant="outline" size="sm">
                            Create from template
                          </Button>
                        </form>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {customDocuments.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-ink-700 mb-3">Additional standard documents</h2>
              <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white">
                {customDocuments.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/admin/lia/documents/${d.slug}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-ink-700 truncate">{d.title}</div>
                        <div className="text-xs text-ink-400">{d.slug}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone="ink">{d.category}</Badge>
                        {d.detailUrl ? <Badge tone="sky">Doc attached</Badge> : null}
                        {d.published ? <Badge tone="green">Live</Badge> : <Badge tone="ink">Draft</Badge>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4" /> New standard document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-500 mb-4 max-w-xl">
                For org-wide policies not in the list above (e.g. a regional handbook). Same upload
                applies to all members via LIA.
              </p>
              <form
                action={createLiaStandardDocument}
                encType="multipart/form-data"
                className="space-y-3 max-w-xl"
              >
                <LiaPolicyFileField detailUrl={null} idPrefix="new-doc" />
                <div>
                  <Label htmlFor="std-slug">Slug</Label>
                  <Input id="std-slug" name="slug" placeholder="whistleblower-policy" required pattern="[a-z0-9-]+" />
                </div>
                <div>
                  <Label htmlFor="std-title">Title</Label>
                  <Input id="std-title" name="title" required />
                </div>
                <div>
                  <Label htmlFor="std-category">Category</Label>
                  <Select id="std-category" name="category" defaultValue="GENERAL">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="std-summary">Summary</Label>
                  <Textarea id="std-summary" name="summary" rows={3} required />
                </div>
                <div>
                  <Label htmlFor="std-body">Body (retrieval text)</Label>
                  <Textarea id="std-body" name="body" rows={6} required />
                </div>
                <div>
                  <Label htmlFor="std-keywords">Keywords (comma-separated)</Label>
                  <Input id="std-keywords" name="keywords" placeholder="conduct, ethics" />
                </div>
                <div>
                  <Label htmlFor="std-detailUrl">External doc URL (optional)</Label>
                  <Input id="std-detailUrl" name="detailUrl" type="url" placeholder="https://…" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink-600">
                    <input type="checkbox" name="published" defaultChecked className="rounded" /> Published
                  </label>
                  <div>
                    <Label htmlFor="std-sortOrder">Sort order</Label>
                    <Input id="std-sortOrder" name="sortOrder" type="number" defaultValue={200} className="w-24" />
                  </div>
                </div>
                <Button type="submit" variant="accent">
                  Create standard document
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Articles ({articles.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-ink-100">
                {articles.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/admin/lia/${a.id}?tab=articles`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-ink-50"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-ink-700 truncate">{a.title}</div>
                        <div className="text-xs text-ink-400">{a.slug}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone="ink">{a.category}</Badge>
                        {a.published ? (
                          <Badge tone="green">Live</Badge>
                        ) : (
                          <Badge tone="ink">Draft</Badge>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
                {articles.length === 0 ? (
                  <li className="px-5 py-8 text-sm text-ink-500 text-center">
                    No articles yet. Use these for FAQs and one-off snippets beyond core documents.
                  </li>
                ) : null}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="size-4" /> New article
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createLiaArticle} className="space-y-3">
                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" name="slug" placeholder="wfh-guidelines" required pattern="[a-z0-9-]+" />
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select id="category" name="category" defaultValue="GENERAL">
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="summary">Summary (LIA uses this in answers)</Label>
                  <Textarea id="summary" name="summary" rows={3} required />
                </div>
                <div>
                  <Label htmlFor="body">Body (retrieval text)</Label>
                  <Textarea id="body" name="body" rows={6} required />
                </div>
                <div>
                  <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                  <Input id="keywords" name="keywords" placeholder="leave, casual, sick" />
                </div>
                <div>
                  <Label htmlFor="detailHref">In-app link (optional)</Label>
                  <Input id="detailHref" name="detailHref" placeholder="/attendance?tab=requests" />
                </div>
                <div>
                  <Label htmlFor="detailUrl">External full doc URL (optional)</Label>
                  <Input id="detailUrl" name="detailUrl" type="url" placeholder="https://docs.google.com/…" />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink-600">
                    <input type="checkbox" name="published" className="rounded" /> Published
                  </label>
                  <div className="flex-1">
                    <Label htmlFor="sortOrder">Sort order</Label>
                    <Input id="sortOrder" name="sortOrder" type="number" defaultValue={100} className="w-24" />
                  </div>
                </div>
                <Button type="submit" variant="accent">
                  Create article
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
