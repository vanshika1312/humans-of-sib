"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAppViewer } from "@/lib/app-viewer";
import { canManageLiaKnowledge } from "@/lib/lia-admin";
import type { LiaKnowledgeCategory } from "@/generated/prisma";
import { getLiaCoreDocument } from "@/lib/lia-core-documents";
import { normalizeLiaDetailUrl } from "@/lib/lia-detail-url";
import { persistLiaPolicyDocumentFile } from "@/lib/lia-document-upload";
import { backfillAllOrgPolicyDocuments } from "@/lib/lia-policy-ingest";

const categories = [
  "LEAVE",
  "ATTENDANCE",
  "PULSE",
  "GENERAL",
  "BENEFITS",
  "CULTURE",
] as const satisfies readonly LiaKnowledgeCategory[];

const documentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4000),
  body: z.string().trim().min(1).max(50000),
  detailHref: z.string().trim().max(2048).optional(),
  detailUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((v) => normalizeLiaDetailUrl(v)),
  published: z.coerce.boolean().optional(),
});

const standardDocumentCreateSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4000),
  body: z.string().trim().min(1).max(50000),
  category: z.enum(categories),
  keywords: z.string().trim().max(2000).optional(),
  detailHref: z.string().trim().max(2048).optional(),
  detailUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((v) => normalizeLiaDetailUrl(v)),
  published: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

const articleSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4000),
  body: z.string().trim().min(1).max(50000),
  category: z.enum(categories),
  keywords: z.string().trim().max(2000).optional(),
  detailHref: z.string().trim().max(2048).optional(),
  detailUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((v) => normalizeLiaDetailUrl(v)),
  published: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

function parseKeywords(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 40);
}

async function requireLiaAdmin() {
  const me = await requireAppViewer();
  if (!canManageLiaKnowledge(me)) redirect("/home");
  return me!;
}

async function resolvePolicyDetailUrl(
  fd: FormData,
  fallbackUrl: string | undefined,
): Promise<string | null | "UPLOAD_TOO_LARGE" | "UPLOAD_UNSUPPORTED"> {
  if (fd.get("clearPolicyFile") === "on") return null;

  const file = fd.get("policyFile");
  if (file instanceof File && file.size > 0) {
    const uploaded = await persistLiaPolicyDocumentFile(file);
    if (!uploaded.ok) {
      if (uploaded.code === "TOO_LARGE") return "UPLOAD_TOO_LARGE";
      return "UPLOAD_UNSUPPORTED";
    }
    return uploaded.url;
  }

  return fallbackUrl?.trim() || null;
}

export async function ensureLiaCoreDocument(slug: string) {
  const me = await requireLiaAdmin();
  const def = getLiaCoreDocument(slug);
  if (!def) redirect("/admin/lia?tab=documents&error=unknown-doc");

  const existing = await prisma.liaKnowledgeArticle.findUnique({ where: { slug } });
  if (existing) redirect(`/admin/lia/documents/${slug}`);

  const row = await prisma.liaKnowledgeArticle.create({
    data: {
      slug: def.slug,
      title: def.title,
      summary: def.summary,
      body: def.body,
      category: def.category,
      keywords: def.keywords,
      detailHref: def.detailHref ?? null,
      kind: "DOCUMENT",
      published: true,
      sortOrder: def.sortOrder,
      updatedById: me.id,
    },
  });

  revalidatePath("/admin/lia");
  redirect(`/admin/lia/documents/${row.slug}`);
}

export async function updateLiaDocument(slug: string, fd: FormData) {
  const me = await requireLiaAdmin();

  const parsed = documentSchema.safeParse({
    title: fd.get("title"),
    summary: fd.get("summary"),
    body: fd.get("body"),
    detailHref: fd.get("detailHref") || undefined,
    detailUrl: fd.get("detailUrl") || undefined,
    published: fd.get("published") === "on",
  });
  if (!parsed.success) redirect(`/admin/lia/documents/${slug}?error=invalid`);

  const d = parsed.data;
  const existing = await prisma.liaKnowledgeArticle.findUnique({ where: { slug } });
  if (!existing || existing.kind !== "DOCUMENT") {
    redirect("/admin/lia?tab=documents&error=missing");
  }

  const resolvedUrl = await resolvePolicyDetailUrl(fd, d.detailUrl);
  if (resolvedUrl === "UPLOAD_TOO_LARGE") {
    redirect(`/admin/lia/documents/${slug}?error=upload-too-large`);
  }
  if (resolvedUrl === "UPLOAD_UNSUPPORTED") {
    redirect(`/admin/lia/documents/${slug}?error=upload-unsupported`);
  }

  await prisma.liaKnowledgeArticle.update({
    where: { slug },
    data: {
      title: d.title,
      summary: d.summary,
      body: d.body,
      detailHref: d.detailHref?.trim() || null,
      detailUrl: resolvedUrl,
      published: d.published ?? false,
      kind: "DOCUMENT",
      updatedById: me.id,
    },
  });

  revalidatePath("/admin/lia");
  revalidatePath(`/admin/lia/documents/${slug}`);
  redirect(`/admin/lia/documents/${slug}?saved=1`);
}

export async function createLiaStandardDocument(fd: FormData) {
  const me = await requireLiaAdmin();
  const parsed = standardDocumentCreateSchema.safeParse({
    slug: fd.get("slug"),
    title: fd.get("title"),
    summary: fd.get("summary"),
    body: fd.get("body"),
    category: fd.get("category"),
    keywords: fd.get("keywords"),
    detailHref: fd.get("detailHref") || undefined,
    detailUrl: fd.get("detailUrl") || undefined,
    published: fd.get("published") === "on",
    sortOrder: fd.get("sortOrder") || 200,
  });
  if (!parsed.success) redirect("/admin/lia?tab=documents&error=invalid");

  const d = parsed.data;
  const taken = await prisma.liaKnowledgeArticle.findUnique({ where: { slug: d.slug } });
  if (taken) redirect("/admin/lia?tab=documents&error=slug-taken");

  const resolvedUrl = await resolvePolicyDetailUrl(fd, d.detailUrl);
  if (resolvedUrl === "UPLOAD_TOO_LARGE" || resolvedUrl === "UPLOAD_UNSUPPORTED") {
    redirect("/admin/lia?tab=documents&error=upload");
  }

  const row = await prisma.liaKnowledgeArticle.create({
    data: {
      slug: d.slug,
      title: d.title,
      summary: d.summary,
      body: d.body,
      category: d.category,
      keywords: parseKeywords(d.keywords),
      detailHref: d.detailHref?.trim() || null,
      detailUrl: resolvedUrl,
      published: d.published ?? true,
      sortOrder: d.sortOrder ?? 200,
      kind: "DOCUMENT",
      updatedById: me.id,
    },
  });

  revalidatePath("/admin/lia");
  redirect(`/admin/lia/documents/${row.slug}?saved=1`);
}

export async function createLiaArticle(fd: FormData) {
  const me = await requireLiaAdmin();
  const parsed = articleSchema.safeParse({
    slug: fd.get("slug"),
    title: fd.get("title"),
    summary: fd.get("summary"),
    body: fd.get("body"),
    category: fd.get("category"),
    keywords: fd.get("keywords"),
    detailHref: fd.get("detailHref") || undefined,
    detailUrl: fd.get("detailUrl") || undefined,
    published: fd.get("published") === "on",
    sortOrder: fd.get("sortOrder") || 0,
  });
  if (!parsed.success) redirect("/admin/lia?tab=articles&error=invalid");

  const d = parsed.data;
  const row = await prisma.liaKnowledgeArticle.create({
    data: {
      slug: d.slug,
      title: d.title,
      summary: d.summary,
      body: d.body,
      category: d.category,
      keywords: parseKeywords(d.keywords),
      detailHref: d.detailHref?.trim() || null,
      detailUrl: d.detailUrl?.trim() || null,
      published: d.published ?? false,
      sortOrder: d.sortOrder ?? 0,
      kind: "ARTICLE",
      updatedById: me.id,
    },
  });

  revalidatePath("/admin/lia");
  redirect(`/admin/lia/${row.id}?tab=articles`);
}

export async function updateLiaArticle(articleId: string, fd: FormData) {
  const me = await requireLiaAdmin();
  const parsed = articleSchema.safeParse({
    slug: fd.get("slug"),
    title: fd.get("title"),
    summary: fd.get("summary"),
    body: fd.get("body"),
    category: fd.get("category"),
    keywords: fd.get("keywords"),
    detailHref: fd.get("detailHref") || undefined,
    detailUrl: fd.get("detailUrl") || undefined,
    published: fd.get("published") === "on",
    sortOrder: fd.get("sortOrder") || 0,
  });
  if (!parsed.success) redirect(`/admin/lia/${articleId}?tab=articles&error=invalid`);

  const d = parsed.data;
  await prisma.liaKnowledgeArticle.update({
    where: { id: articleId },
    data: {
      slug: d.slug,
      title: d.title,
      summary: d.summary,
      body: d.body,
      category: d.category,
      keywords: parseKeywords(d.keywords),
      detailHref: d.detailHref?.trim() || null,
      detailUrl: d.detailUrl?.trim() || null,
      published: d.published ?? false,
      sortOrder: d.sortOrder ?? 0,
      updatedById: me.id,
    },
  });

  revalidatePath("/admin/lia");
  revalidatePath(`/admin/lia/${articleId}`);
  redirect(`/admin/lia/${articleId}?tab=articles&saved=1`);
}

export async function deleteLiaArticle(articleId: string) {
  await requireLiaAdmin();
  await prisma.liaKnowledgeArticle.delete({ where: { id: articleId } });
  revalidatePath("/admin/lia");
  redirect("/admin/lia?tab=articles");
}

/** Re-index company-wide POLICY uploads from Documents into LIA knowledge articles. */
export async function backfillOrgPolicyDocumentsForLia() {
  const me = await requireLiaAdmin();
  const result = await backfillAllOrgPolicyDocuments(me.id);
  revalidatePath("/admin/lia");
  revalidatePath("/documents");
  const qs = new URLSearchParams({
    tab: "documents",
    backfill: String(result.synced),
    backfillSkipped: String(result.skipped),
  });
  if (result.errors.length) qs.set("backfillErrors", String(Math.min(result.errors.length, 5)));
  redirect(`/admin/lia?${qs.toString()}`);
}
