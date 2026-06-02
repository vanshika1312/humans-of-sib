import { persistHiringResumeFile } from "@/lib/hiring-resume-upload";

export type TrainingContentUploadResult =
  | { ok: true; url: string }
  | { ok: false; code: "TOO_LARGE" | "UNSUPPORTED" | "EMPTY" };

/** PDF only — same storage as hiring résumés (R2, Blob, or local `/hiring-uploads`). */
export async function persistTrainingContentFile(file: unknown): Promise<TrainingContentUploadResult> {
  if (!(file instanceof File) || file.size <= 0) return { ok: false, code: "EMPTY" };
  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf")) return { ok: false, code: "UNSUPPORTED" };
  const uploaded = await persistHiringResumeFile(file);
  if (uploaded === "TOO_LARGE") return { ok: false, code: "TOO_LARGE" };
  if (uploaded === "UNSUPPORTED_TYPE") return { ok: false, code: "UNSUPPORTED" };
  return { ok: true, url: uploaded };
}
