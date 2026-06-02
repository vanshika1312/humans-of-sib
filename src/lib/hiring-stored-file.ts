import { readFile } from "fs/promises";
import path from "node:path";
import { isBulkImportStoredResumeUrl } from "@/lib/hiring-resume-upload";

function fileNameFromUrl(url: string, fallback: string): string {
  try {
    const base = path.basename(new URL(url).pathname);
    if (base && base !== "/") return decodeURIComponent(base);
  } catch {
    const local = path.basename(url.split("?")[0] ?? "");
    if (local) return local;
  }
  return fallback;
}

/** Loads bytes for résumés/files stored by this app (local public/, R2, or Vercel Blob). */
export async function loadHiringStoredFileBuffer(
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
      const absolute =
        u.startsWith("http://") || u.startsWith("https://")
          ? u
          : `${(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${u.startsWith("/") ? u : `/${u}`}`;
      const res = await fetch(absolute);
      if (!res.ok) return { ok: false, error: "Could not fetch stored file." };
      const buffer = Buffer.from(await res.arrayBuffer());
      return { ok: true, buffer, fileName: fileNameFromUrl(u, fileNameHint) };
    } catch {
      return { ok: false, error: "Could not fetch stored file." };
    }
  }

  return { ok: false, error: "URL is not a stored upload in this app." };
}

export function mimeTypeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}
