import { Suspense } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { canManageLiaKnowledge } from "@/lib/lia-admin";
import { firstSearchParam } from "@/lib/search-param";
import { RouteBodyFallback } from "@/components/app-route-body-fallback";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Input, Textarea, Select } from "@/components/ui/input";
import { updateLiaArticle, deleteLiaArticle } from "../actions";
import { DeleteLiaArticleButton } from "../_components/delete-lia-article-button";

const CATEGORIES = ["LEAVE", "ATTENDANCE", "PULSE", "GENERAL", "BENEFITS", "CULTURE"] as const;

export default function AdminLiaEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<RouteBodyFallback />}>
      <AdminLiaEditPageInner params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminLiaEditPageInner({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const saved = firstSearchParam(sp.saved) === "1";

  const me = await requireAppViewer();
  if (!canManageLiaKnowledge(me)) redirect("/home");

  const article = await prisma.liaKnowledgeArticle.findUnique({ where: { id } });
  if (!article) notFound();
  if (article.kind === "DOCUMENT") redirect(`/admin/lia/documents/${article.slug}`);

  return (
    <div>
      <PageHeader
        title={article.title}
        emoji="✨"
        subtitle="Edit knowledge article for LIA."
        action={
          <Link href="/admin/lia?tab=articles">
            <Button variant="outline">All articles</Button>
          </Link>
        }
      />
      {saved ? (
        <p className="mb-4 text-sm text-emerald-700 font-medium">Saved.</p>
      ) : null}
      <Card>
        <CardContent className="pt-6">
          <form action={updateLiaArticle.bind(null, article.id)} className="space-y-3 max-w-2xl">
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" defaultValue={article.slug} required pattern="[a-z0-9-]+" />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={article.title} required />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" name="category" defaultValue={article.category}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="summary">Summary</Label>
              <Textarea id="summary" name="summary" rows={3} defaultValue={article.summary} required />
            </div>
            <div>
              <Label htmlFor="body">Body</Label>
              <Textarea id="body" name="body" rows={10} defaultValue={article.body} required />
            </div>
            <div>
              <Label htmlFor="keywords">Keywords</Label>
              <Input id="keywords" name="keywords" defaultValue={article.keywords.join(", ")} />
            </div>
            <div>
              <Label htmlFor="detailHref">In-app link</Label>
              <Input id="detailHref" name="detailHref" defaultValue={article.detailHref ?? ""} />
            </div>
            <div>
              <Label htmlFor="detailUrl">External doc URL</Label>
              <Input id="detailUrl" name="detailUrl" type="url" defaultValue={article.detailUrl ?? ""} />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-ink-600">
                <input type="checkbox" name="published" defaultChecked={article.published} className="rounded" />{" "}
                Published
              </label>
              <div>
                <Label htmlFor="sortOrder">Sort order</Label>
                <Input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  defaultValue={article.sortOrder}
                  className="w-24"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" variant="accent">
                Save
              </Button>
            </div>
          </form>
          <DeleteLiaArticleButton action={deleteLiaArticle.bind(null, article.id)} />
        </CardContent>
      </Card>
    </div>
  );
}
