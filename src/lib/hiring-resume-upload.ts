import { mkdir, writeFile } from "fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { isR2StoredResumeUrl, persistBufferToR2, r2ConfigComplete } from "@/lib/hiring-resume-r2";

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

/** True when `resumeUrl` points at a file uploaded by this app (local dev, R2, or Vercel Blob), not a pasted Drive link. */
export function isBulkImportStoredResumeUrl(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return false;
  if (u.startsWith("/hiring-uploads/")) return true;
  if (isR2StoredResumeUrl(u)) return true;
  if (u.startsWith("https://") && u.includes(".blob.vercel-storage.com/")) return true;
  return false;
}

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

/** Serverless hosts expose a read-only bundle (e.g. `/var/task`); `public/` cannot be written at runtime. */
function isServerlessReadOnlyDeploy(): boolean {
  if (process.env.VERCEL) return true;
  if (process.env.AWS_LAMBDA_FUNCTION_NAME) return true;
  if (process.env.NETLIFY === "true") return true;
  try {
    if (process.cwd().startsWith("/var/task")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

const MISSING_REMOTE_STORAGE_MESSAGE =
  "Résumé uploads on serverless hosts need remote storage: set Cloudflare R2 vars (R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL), or set BLOB_READ_WRITE_TOKEN for Vercel Blob. Local public/ is read-only on this host.";

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
  const fp = path.join(dir, fname);
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(fp, buf);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : undefined;
    // Non-serverless but read-only disk (Docker, hardening) — same remediation as Lambda/Vercel.
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      console.error("[hiring-resume-upload] cannot write under public/hiring-uploads.", err);
      throw new Error(MISSING_REMOTE_STORAGE_MESSAGE);
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
 * Stores résumé bytes and returns a public HTTPS URL (R2 or Vercel Blob) or a relative `/hiring-uploads/…` path.
 * Serverless: set R2 env vars (preferred) or `BLOB_READ_WRITE_TOKEN` — `public/` is not writable.
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

  if (r2ConfigComplete()) {
    return await persistBufferToR2(buf, ext, contentTypeForExt(ext));
  }
  if (blobToken()) {
    return await persistBufferToBlob(buf, ext);
  }
  if (isServerlessReadOnlyDeploy()) {
    throw new Error(MISSING_REMOTE_STORAGE_MESSAGE);
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
