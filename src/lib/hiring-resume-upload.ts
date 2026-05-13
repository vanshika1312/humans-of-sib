import { mkdir, writeFile } from "fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

/**
 * Stores an uploaded résumé under `/public/hiring-uploads/` and returns a relative public URL path.
 */
export async function persistHiringResumeFile(
  file: unknown,
): Promise<string | "TOO_LARGE" | "UNSUPPORTED_TYPE"> {
  if (!(file instanceof File) || file.size <= 0) return "UNSUPPORTED_TYPE";
  if (file.size > MAX_BYTES) return "TOO_LARGE";

  const type = (file.type || "").toLowerCase();
  let ext: string | null = MIME_EXT[type] ?? null;
  if (!ext) {
    ext = extFromFilename(file.name);
  }
  if (!ext) return "UNSUPPORTED_TYPE";

  const buf = Buffer.from(await file.arrayBuffer());
  const fname = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "hiring-uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fname), buf);
  return `/hiring-uploads/${fname}`;
}

function resolveResumeExt(fileName: string, mimeHint?: string): string | null {
  const type = (mimeHint || "").toLowerCase();
  let ext: string | null = MIME_EXT[type] ?? null;
  if (!ext) ext = extFromFilename(fileName);
  return ext;
}

/**
 * Store résumé bytes (e.g. from inbound email webhook) under `/public/hiring-uploads/`.
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
  const fname = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "hiring-uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fname), buf);
  return `/hiring-uploads/${fname}`;
}
