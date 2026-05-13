import { prisma } from "@/lib/prisma";
import { persistHiringResumeBuffer } from "@/lib/hiring-resume-upload";
import { extractResumeTextFromBuffer } from "@/lib/hiring-resume-text";
import {
  parseResumeFieldsWithLlm,
  type ParsedResumeFields,
} from "@/lib/hiring-resume-llm";
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

/**
 * Persist one résumé file into an existing import batch (extract text + optional LLM parse).
 */
export async function createHiringResumeImportItemFromBuffer(opts: {
  batchId: string;
  buffer: Buffer;
  originalFileName: string;
  mimeHint?: string;
}): Promise<void> {
  const displayName = opts.originalFileName.slice(0, 280);
  const uploaded = await persistHiringResumeBuffer(
    opts.buffer,
    opts.originalFileName,
    opts.mimeHint,
  );

  const parsedAt = new Date();

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
  const llm = await parseResumeFieldsWithLlm(textResult.text);
  const parsed = llm.ok ? llm.parsed : llm.parsed ?? EMPTY_PARSED;
  const warnings: string[] = [];
  if (!llm.ok && llm.error) warnings.push(llm.error);

  const payload: StoredResumePayload = {
    parsed,
    warnings: warnings.length ? warnings : undefined,
  };

  const status: HiringResumeImportItemStatus = "PARSED";
  const error: string | null = null;

  await prisma.hiringResumeImportItem.create({
    data: {
      batchId: opts.batchId,
      fileName: displayName,
      resumeUrl,
      extractedText,
      parsedPayloadJson: JSON.stringify(payload),
      parseModel: llm.ok ? llm.model : null,
      parsedAt,
      status,
      error,
    },
  });
}
