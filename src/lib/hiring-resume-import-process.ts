import { prisma } from "@/lib/prisma";
import { persistHiringResumeBuffer } from "@/lib/hiring-resume-upload";
import { extractResumeTextFromBuffer } from "@/lib/hiring-resume-text";
import type { ParsedResumeFields } from "@/lib/hiring-resume-llm";
import {
  AFFINDA_RESUME_MAX_BYTES,
  isAffindaResumeParsingConfigured,
  parseResumeWithAffinda,
} from "@/lib/hiring-resume-affinda";
import type { HiringResumeImportItemStatus } from "@/generated/prisma";

export type StoredResumePayload = {
  parsed: ParsedResumeFields;
  warnings?: string[];
};

const EMPTY_PARSED: ParsedResumeFields = {
  fullName: null,
  email: null,
  phone: null,
  candidateLocation: null,
  fieldConfidence: {},
};

function normalizeEnvToken(raw: string | undefined): string {
  let s = (raw ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/** Explains why auto-parse did not run (bulk import never calls OpenAI). */
function bulkImportManualParsingNotice(): string {
  const ws = normalizeEnvToken(process.env.AFFINDA_WORKSPACE);
  const key =
    normalizeEnvToken(process.env.AFFINDA_API_KEY) ||
    normalizeEnvToken(process.env.HIRING_RESUME_PARSE_API_KEY);
  if (key.startsWith("aff_") && !ws) {
    return "AFFINDA_WORKSPACE is missing. Your key looks like Affinda — add the workspace ID from the Affinda app. This importer does not call OpenAI.";
  }
  return "Automatic extraction uses Affinda only (OpenAI is not used). Set AFFINDA_WORKSPACE and your Affinda API key on the server, then restart — or fill rows manually.";
}

/**
 * Persist one résumé file into an existing import batch (Affinda parse when configured; otherwise manual fill + stored plain text).
 */
export async function createHiringResumeImportItemFromBuffer(opts: {
  batchId: string;
  buffer: Buffer;
  originalFileName: string;
  mimeHint?: string;
}): Promise<void> {
  const displayName = opts.originalFileName.slice(0, 280);
  const parsedAt = new Date();
  const affindaOn = isAffindaResumeParsingConfigured();

  if (affindaOn && opts.buffer.length > AFFINDA_RESUME_MAX_BYTES) {
    await prisma.hiringResumeImportItem.create({
      data: {
        batchId: opts.batchId,
        fileName: displayName,
        resumeUrl: "",
        status: "FAILED",
        error: `Résumé exceeds Affinda limit (${AFFINDA_RESUME_MAX_BYTES / (1024 * 1024)} MB). Use a smaller file or disable Affinda for this batch.`,
        parsedPayloadJson: JSON.stringify({
          parsed: EMPTY_PARSED,
        } satisfies StoredResumePayload),
        parsedAt,
      },
    });
    return;
  }

  const uploaded = await persistHiringResumeBuffer(
    opts.buffer,
    opts.originalFileName,
    opts.mimeHint,
  );

  if (uploaded === "TOO_LARGE" || uploaded === "UNSUPPORTED_TYPE") {
    await prisma.hiringResumeImportItem.create({
      data: {
        batchId: opts.batchId,
        fileName: displayName,
        resumeUrl: "",
        status: "FAILED",
        error:
          uploaded === "TOO_LARGE"
            ? "File too large (max 12 MB)."
            : "Unsupported type — use PDF or DOCX.",
        parsedPayloadJson: JSON.stringify({
          parsed: EMPTY_PARSED,
        } satisfies StoredResumePayload),
        parsedAt,
      },
    });
    return;
  }

  const resumeUrl = uploaded;

  if (affindaOn) {
    const aff = await parseResumeWithAffinda({
      buffer: opts.buffer,
      fileName: opts.originalFileName,
      mimeHint: opts.mimeHint,
    });
    const parsed = aff.ok ? aff.parsed : aff.parsed ?? EMPTY_PARSED;
    const warnings: string[] = [];
    if (!aff.ok && aff.error) warnings.push(aff.error);

    const payload: StoredResumePayload = {
      parsed,
      warnings: warnings.length ? warnings : undefined,
    };

    await prisma.hiringResumeImportItem.create({
      data: {
        batchId: opts.batchId,
        fileName: displayName,
        resumeUrl,
        extractedText: null,
        parsedPayloadJson: JSON.stringify(payload),
        parseModel: aff.ok ? aff.model : null,
        parsedAt,
        status: "PARSED",
        error: null,
      },
    });
    return;
  }

  const textResult = await extractResumeTextFromBuffer(opts.buffer, opts.originalFileName);

  if (!textResult.ok) {
    await prisma.hiringResumeImportItem.create({
      data: {
        batchId: opts.batchId,
        fileName: displayName,
        resumeUrl,
        status: "FAILED",
        error: textResult.error,
        parsedPayloadJson: JSON.stringify({
          parsed: EMPTY_PARSED,
        } satisfies StoredResumePayload),
        parsedAt,
      },
    });
    return;
  }

  const extractedText = textResult.text.slice(0, 80_000);
  const payload: StoredResumePayload = {
    parsed: EMPTY_PARSED,
    warnings: [bulkImportManualParsingNotice()],
  };

  const status: HiringResumeImportItemStatus = "PARSED";

  await prisma.hiringResumeImportItem.create({
    data: {
      batchId: opts.batchId,
      fileName: displayName,
      resumeUrl,
      extractedText,
      parsedPayloadJson: JSON.stringify(payload),
      parseModel: null,
      parsedAt,
      status,
      error: null,
    },
  });
}
