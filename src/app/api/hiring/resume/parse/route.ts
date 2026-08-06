import { requireAppViewer } from "@/lib/app-viewer";
import { prisma } from "@/lib/prisma";
import { extractResumeTextFromBuffer } from "@/lib/hiring-resume-text";
import { resolveResumeFields } from "@/lib/hiring-resume-fields";
import { computeResumeSkillMatch } from "@/lib/hiring-resume-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECRUITER_ROLES = ["CEO", "ADMIN", "HR"] as const;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Parses a single uploaded résumé (PDF/DOCX) for the candidate intake forms: extracts plain text,
 * resolves profile fields via local heuristics (HiringPlatform-style; no LLM), and — when `jobId`
 * is provided — an ATS-style skill match preview against that job's required skills. Nothing is
 * persisted here; the caller (server action) re-does the scoring at save time against whichever
 * job actually gets attached.
 */
export async function POST(request: Request) {
  const viewer = await requireAppViewer();
  if (!viewer) return json({ ok: false, error: "Unauthorized" }, 401);
  if (!RECRUITER_ROLES.includes(viewer.role as (typeof RECRUITER_ROLES)[number])) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ ok: false, error: "Expected multipart/form-data with a `file` field." }, 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) {
    return json({ ok: false, error: "No résumé file was provided." }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return json({ ok: false, error: "Résumé is too large — please upload a file under 12 MB." }, 413);
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx") && !lowerName.endsWith(".doc")) {
    return json({ ok: false, error: "Résumé must be a PDF, DOC, or DOCX file." }, 415);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractResumeTextFromBuffer(buffer, file.name);
  if (!extracted.ok) {
    return json({ ok: false, error: extracted.error }, 422);
  }

  const resolved = await resolveResumeFields(extracted.text);

  const jobId = String(formData.get("jobId") || "").trim();
  let atsPreview: { score: number; matched: string[]; missing: string[]; jobTitle: string } | null = null;
  if (jobId) {
    const job = await prisma.hiringJob.findUnique({
      where: { id: jobId },
      select: { title: true, skillsRequired: true },
    });
    if (job) {
      const match = computeResumeSkillMatch(extracted.text, job.skillsRequired);
      atsPreview = { ...match, jobTitle: job.title };
    }
  }

  return json({
    ok: true,
    fileName: file.name,
    extractedTextLength: extracted.text.length,
    fullName: resolved.parsed.fullName,
    email: resolved.parsed.email,
    phone: resolved.parsed.phone,
    candidateLocation: resolved.parsed.candidateLocation,
    fieldSource: resolved.source,
    parseModel: resolved.model,
    warnings: resolved.warnings,
    atsPreview,
  });
}
