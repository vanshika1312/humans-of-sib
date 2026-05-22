import { mkdir, writeFile } from "fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { r2ConfigComplete, r2PublicBaseUrlNormalized } from "@/lib/hiring-resume-r2";
import { persistHiringResumeBuffer } from "@/lib/hiring-resume-upload";

const MAX_BYTES = 15 * 1024 * 1024;

const EXTRA_MIME_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "text/plain": ".txt",
  "text/markdown": ".md",
};

function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

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

const MISSING_STORAGE =
  "Task attachments need remote storage (R2 env vars or BLOB_READ_WRITE_TOKEN).";

async function persistBufferToBlob(buf: Buffer, ext: string, contentType: string): Promise<string> {
  const pathname = `task-uploads/${randomUUID()}${ext}`;
  const { url } = await put(pathname, buf, {
    access: "public",
    token: blobToken(),
    contentType,
    addRandomSuffix: false,
  });
  return url;
}

function trimEnv(s: string | undefined): string | undefined {
  const t = s?.trim();
  return t || undefined;
}

function r2S3Client(): S3Client {
  const accountId = trimEnv(process.env.R2_ACCOUNT_ID)!;
  const endpoint =
    trimEnv(process.env.R2_ENDPOINT) ?? `https://${accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: trimEnv(process.env.R2_ACCESS_KEY_ID)!,
      secretAccessKey: trimEnv(process.env.R2_SECRET_ACCESS_KEY)!,
    },
  });
}

async function persistBufferToTaskR2(buf: Buffer, ext: string, contentType: string): Promise<string> {
  const bucket = trimEnv(process.env.R2_BUCKET_NAME)!;
  const key = `task-uploads/${randomUUID()}${ext}`;
  const client = r2S3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: contentType,
    }),
  );
  const base = r2PublicBaseUrlNormalized()!;
  return `${base}/${key}`;
}

async function persistBufferToLocalPublic(buf: Buffer, ext: string): Promise<string> {
  const fname = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "task-uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fname), buf);
  return `/task-uploads/${fname}`;
}

function extFromMimeOrName(type: string, fileName: string): string | null {
  const t = type.toLowerCase();
  if (EXTRA_MIME_EXT[t]) return EXTRA_MIME_EXT[t];
  const lower = fileName.toLowerCase();
  const vals = new Set(Object.values(EXTRA_MIME_EXT));
  for (const ext of vals) {
    if (lower.endsWith(ext)) return ext;
  }
  return null;
}

function contentTypeForExt(ext: string): string {
  const hit = Object.entries(EXTRA_MIME_EXT).find(([, e]) => e === ext);
  return hit ? hit[0] : "application/octet-stream";
}

export type PersistTaskAttachmentResult =
  | { ok: true; url: string; fileName: string; mimeType: string; size: number }
  | { ok: false; code: "TOO_LARGE" | "UNSUPPORTED" | "STORAGE" };

/**
 * PDF / DOC / DOCX reuse hiring pipeline; PNG / JPEG / GIF / WEBP / TXT / MD plus same remote/local rules.
 */
export async function persistTaskAttachmentFile(file: unknown): Promise<PersistTaskAttachmentResult> {
  if (!(file instanceof File) || file.size <= 0) return { ok: false, code: "UNSUPPORTED" };
  const buf = Buffer.from(await file.arrayBuffer());
  const size = buf.length;
  if (size > MAX_BYTES) return { ok: false, code: "TOO_LARGE" };

  try {
    const docUrl = await persistHiringResumeBuffer(buf, file.name, file.type || undefined);
    if (docUrl !== "TOO_LARGE" && docUrl !== "UNSUPPORTED_TYPE") {
      return {
        ok: true,
        url: docUrl,
        fileName: file.name.slice(0, 280),
        mimeType: (file.type || "application/octet-stream").slice(0, 120),
        size,
      };
    }
  } catch {
    return { ok: false, code: "STORAGE" };
  }

  const ext = extFromMimeOrName(file.type || "", file.name);
  if (!ext) return { ok: false, code: "UNSUPPORTED" };

  const contentType = contentTypeForExt(ext);
  try {
    let url: string;
    if (r2ConfigComplete()) {
      url = await persistBufferToTaskR2(buf, ext, contentType);
    } else if (blobToken()) {
      url = await persistBufferToBlob(buf, ext, contentType);
    } else if (isServerlessReadOnlyDeploy()) {
      throw new Error(MISSING_STORAGE);
    } else {
      url = await persistBufferToLocalPublic(buf, ext);
    }
    return {
      ok: true,
      url,
      fileName: file.name.slice(0, 280),
      mimeType: contentType.slice(0, 120),
      size,
    };
  } catch {
    return { ok: false, code: "STORAGE" };
  }
}
