import { mkdir, writeFile } from "fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";

const MAX_BYTES = 12 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

function extFromFilename(name: string): string | null {
  const lower = name.toLowerCase().trim();
  if (lower.endsWith(".pdf")) return ".pdf";
  if (lower.endsWith(".doc")) return ".doc";
  if (lower.endsWith(".docx")) return ".docx";
  return null;
}

function contentTypeForExt(ext: string): string {
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

/** True when `resumeUrl` points at a file uploaded by this app (local dev or Vercel Blob), not a pasted Drive link. */
export function isBulkImportStoredResumeUrl(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return false;
  if (u.startsWith("/hiring-uploads/")) return true;
  if (u.startsWith("https://") && u.includes(".blob.vercel-storage.com/")) return true;
  return false;
}

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

async function persistBufferToBlob(buf: Buffer, ext: string): Promise<string> {
  const pathname = `hiring-uploads/${randomUUID()}${ext}`;
  const { url } = await put(pathname, buf, {
    access: "public",
    token: blobToken(),
    contentType: contentTypeForExt(ext),
    addRandomSuffix: false,
  });
  return url;
}

async function persistBufferToLocalPublic(buf: Buffer, ext: string): Promise<string> {
  const fname = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "hiring-uploads");
  await mkdir(dir, { recursive: true });
  const fp = path.join(dir, fname);
  try {
    await writeFile(fp, buf);
  } catch (err) {
    if (process.env.VERCEL) {
      console.error("[hiring-resume-upload] local write failed on Vercel (filesystem is read-only).", err);
      throw new Error(
        "Résumé storage is not configured for production. Create a Vercel Blob store and set BLOB_READ_WRITE_TOKEN in project environment variables.",
      );
    }
    throw err;
  }
  return `/hiring-uploads/${fname}`;
}

function resolveResumeExt(fileName: string, mimeHint?: string): string | null {
  const type = (mimeHint || "").toLowerCase();
  let ext: string | null = MIME_EXT[type] ?? null;
  if (!ext) ext = extFromFilename(fileName);
  return ext;
}

/**
 * Stores résumé bytes and returns either a Blob HTTPS URL or a relative `/hiring-uploads/…` path.
 * Production (Vercel): set `BLOB_READ_WRITE_TOKEN` — `public/` is not writable on serverless.
 */
export async function persistHiringResumeBuffer(
  buf: Buffer,
  fileName: string,
  mimeHint?: string,
): Promise<string | "TOO_LARGE" | "UNSUPPORTED_TYPE"> {
  if (!buf?.length) return "UNSUPPORTED_TYPE";
  if (buf.length > MAX_BYTES) return "TOO_LARGE";
  const ext = resolveResumeExt(fileName, mimeHint);
  if (!ext) return "UNSUPPORTED_TYPE";

  if (blobToken()) {
    return await persistBufferToBlob(buf, ext);
  }
  return await persistBufferToLocalPublic(buf, ext);
}

/**
 * Stores an uploaded résumé from a `File` input (candidate intake forms, etc.).
 */
export async function persistHiringResumeFile(
  file: unknown,
): Promise<string | "TOO_LARGE" | "UNSUPPORTED_TYPE"> {
  if (!(file instanceof File) || file.size <= 0) return "UNSUPPORTED_TYPE";
  const buf = Buffer.from(await file.arrayBuffer());
  return persistHiringResumeBuffer(buf, file.name, file.type || undefined);
}
