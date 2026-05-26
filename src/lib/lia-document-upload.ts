import { persistHiringResumeFile } from "@/lib/hiring-resume-upload";

export type LiaPolicyUploadResult =
  | { ok: true; url: string }
  | { ok: false; code: "TOO_LARGE" | "UNSUPPORTED" | "EMPTY" };

/** PDF, DOC, or DOCX — same storage as hiring résumés (R2, Blob, or local `/hiring-uploads`). */
export async function persistLiaPolicyDocumentFile(file: unknown): Promise<LiaPolicyUploadResult> {
  if (!(file instanceof File) || file.size <= 0) return { ok: false, code: "EMPTY" };
  const uploaded = await persistHiringResumeFile(file);
  if (uploaded === "TOO_LARGE") return { ok: false, code: "TOO_LARGE" };
  if (uploaded === "UNSUPPORTED_TYPE") return { ok: false, code: "UNSUPPORTED" };
  return { ok: true, url: uploaded };
}
