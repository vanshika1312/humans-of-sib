import { readFile } from "fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { extractResumeTextFromBuffer } from "@/lib/hiring-resume-text";
import { isBulkImportStoredResumeUrl } from "@/lib/hiring-resume-upload";
import type { LiaKnowledgeCategory } from "@/generated/prisma";

const MAX_BODY = 50_000;
const MAX_SUMMARY = 4_000;
const ORG_POLICY_SORT_ORDER = 500;

export function orgPolicyArticleSlug(documentId: string): string {
  return `org-policy-${documentId}`;
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function fileNameFromUrl(url: string, fallback: string): string {
  try {
    const pathname = new URL(url, "http://local").pathname;
    const base = path.basename(pathname);
    if (base && base !== "/") return base;
  } catch {
    const local = url.split("/").pop();
    if (local) return local;
  }
  return fallback;
}

export function inferPolicyCategory(title: string): LiaKnowledgeCategory {
  const t = title.toLowerCase();
  if (/\b(leave|casual|sick|pto|holiday)\b/.test(t)) return "LEAVE";
  if (/\b(attendance|check-in|wfh|biometric)\b/.test(t)) return "ATTENDANCE";
  if (/\b(pulse|survey|engagement)\b/.test(t)) return "PULSE";
  if (/\b(benefit|insurance|esop)\b/.test(t)) return "BENEFITS";
  return "GENERAL";
}

export function buildPolicyKeywords(title: string): string[] {
  const base = ["policy", "document", "org"];
  const fromTitle = title
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  const categoryHints: string[] = [];
  const t = title.toLowerCase();
  if (/\bleave\b/.test(t)) categoryHints.push("leave", "casual", "sick");
  if (/\bcasual\b/.test(t)) categoryHints.push("casual");
  return [...new Set([...base, ...fromTitle, ...categoryHints])].slice(0, 40);
}

export async function loadStoredPolicyFileBuffer(
  url: string,
  fileNameHint: string,
): Promise<{ ok: true; buffer: Buffer; fileName: string } | { ok: false; error: string }> {
  const u = url.trim();
  if (u.startsWith("/hiring-uploads/")) {
    const rel = u.replace(/^\//, "");
    const fp = path.join(process.cwd(), "public", rel);
    try {
      const buffer = await readFile(fp);
      return { ok: true, buffer, fileName: path.basename(fp) || fileNameHint };
    } catch {
      return { ok: false, error: "Could not read stored file from disk." };
    }
  }

  if (isBulkImportStoredResumeUrl(u)) {
    try {
      const res = await fetch(u);
      if (!res.ok) return { ok: false, error: "Could not fetch stored file." };
      const buffer = Buffer.from(await res.arrayBuffer());
      return { ok: true, buffer, fileName: fileNameFromUrl(u, fileNameHint) };
    } catch {
      return { ok: false, error: "Could not fetch stored file." };
    }
  }

  return { ok: false, error: "Policy file URL is not a stored upload." };
}

export type IngestOrgPolicyInput = {
  documentId: string;
  title: string;
  detailUrl: string;
  updatedById: string;
  buffer: Buffer;
  fileName: string;
};

export type IngestOrgPolicyResult =
  | { ok: true; slug: string; extractionWarning?: string }
  | { ok: false; error: string };

export async function ingestOrgPolicyDocument(input: IngestOrgPolicyInput): Promise<IngestOrgPolicyResult> {
  const slug = orgPolicyArticleSlug(input.documentId);
  const category = inferPolicyCategory(input.title);
  const keywords = buildPolicyKeywords(input.title);

  const extracted = await extractResumeTextFromBuffer(input.buffer, input.fileName);
  let extractionWarning: string | undefined;
  let body: string;
  let summary: string;

  if (extracted.ok) {
    body = truncate(extracted.text, MAX_BODY);
    summary = truncate(extracted.text, MAX_SUMMARY);
  } else {
    extractionWarning = extracted.error;
    summary = truncate(
      `${input.title}. Full policy PDF is available in Documents; LIA could not extract text from the file (${extracted.error}). Ask HR for details or edit this article under Admin → LIA.`,
      MAX_SUMMARY,
    );
    body = truncate(
      `Official policy document: ${input.title}\n\nThe uploaded file could not be read as text. Members should open the PDF in Documents. HR can paste policy text in Admin → LIA for this slug (${slug}).`,
      MAX_BODY,
    );
  }

  await prisma.liaKnowledgeArticle.upsert({
    where: { slug },
    create: {
      slug,
      title: input.title.slice(0, 200),
      summary,
      body,
      kind: "DOCUMENT",
      category,
      keywords,
      detailHref: "/documents",
      detailUrl: input.detailUrl.slice(0, 2048),
      published: true,
      sortOrder: ORG_POLICY_SORT_ORDER,
      updatedById: input.updatedById,
    },
    update: {
      title: input.title.slice(0, 200),
      summary,
      body,
      kind: "DOCUMENT",
      category,
      keywords,
      detailHref: "/documents",
      detailUrl: input.detailUrl.slice(0, 2048),
      published: true,
      sortOrder: ORG_POLICY_SORT_ORDER,
      updatedById: input.updatedById,
    },
  });

  return { ok: true, slug, extractionWarning };
}

export async function ingestOrgPolicyFromStoredDocument(doc: {
  id: string;
  title: string;
  url: string;
  mimeType: string | null;
  uploadedById: string;
}): Promise<IngestOrgPolicyResult> {
  const fileNameHint =
    doc.mimeType?.includes("wordprocessingml") || doc.url.toLowerCase().endsWith(".docx")
      ? "policy.docx"
      : "policy.pdf";
  const loaded = await loadStoredPolicyFileBuffer(doc.url, fileNameHint);
  if (!loaded.ok) return { ok: false, error: loaded.error };

  return ingestOrgPolicyDocument({
    documentId: doc.id,
    title: doc.title,
    detailUrl: doc.url,
    updatedById: doc.uploadedById,
    buffer: loaded.buffer,
    fileName: loaded.fileName,
  });
}

export type BackfillOrgPolicyResult = {
  synced: number;
  skipped: number;
  errors: string[];
};

export async function backfillAllOrgPolicyDocuments(
  updatedById: string,
): Promise<BackfillOrgPolicyResult> {
  const docs = await prisma.document.findMany({
    where: { scope: "FOR_ALL", type: "POLICY" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      url: true,
      mimeType: true,
      uploadedById: true,
    },
  });

  const result: BackfillOrgPolicyResult = { synced: 0, skipped: 0, errors: [] };

  for (const doc of docs) {
    const ingested = await ingestOrgPolicyFromStoredDocument({
      ...doc,
      uploadedById: updatedById,
    });
    if (ingested.ok) {
      result.synced += 1;
    } else {
      result.skipped += 1;
      result.errors.push(`${doc.title}: ${ingested.error}`);
    }
  }

  return result;
}
