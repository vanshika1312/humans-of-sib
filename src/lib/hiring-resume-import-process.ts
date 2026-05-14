import { prisma } from "@/lib/prisma";
import { persistHiringResumeBuffer } from "@/lib/hiring-resume-upload";
import { extractResumeTextFromBuffer } from "@/lib/hiring-resume-text";
import type { ParsedResumeFields } from "@/lib/hiring-resume-llm";
import { isLlmResumeParsingConfigured, parseResumeFieldsWithLlm } from "@/lib/hiring-resume-llm";
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

/** Shown when LLM parsing is not configured and fields must be filled by hand. */
function bulkImportManualParsingNotice(): string {
  return "Automatic parsing is not configured. Set OPENROUTER_API_KEY (or a compatible OpenAI-style key with HIRING_RESUME_PARSE_BASE_URL), restart the server, then try again — or fill rows manually.";
}

/**
 * Persist one résumé file into an existing import batch (OpenRouter / OpenAI-compatible LLM when configured; otherwise manual fill + stored plain text).
 */
export async function createHiringResumeImportItemFromBuffer(opts: {
  batchId: string;
  buffer: Buffer;
  originalFileName: string;
  mimeHint?: string;
}): Promise<void> {
  const displayName = opts.originalFileName.slice(0, 280);
  const parsedAt = new Date();
  const llmOn = isLlmResumeParsingConfigured();

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

  if (llmOn) {
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
    const llm = await parseResumeFieldsWithLlm(extractedText);
    const parsed = llm.ok ? llm.parsed : llm.parsed ?? EMPTY_PARSED;
    const warnings: string[] = [];
    if (!llm.ok && llm.error) warnings.push(llm.error);

    const payload: StoredResumePayload = {
      parsed,
      warnings: warnings.length ? warnings : undefined,
    };

    const parseModelLabel = llm.ok ? llm.model.slice(0, 120) : null;

    await prisma.hiringResumeImportItem.create({
      data: {
        batchId: opts.batchId,
        fileName: displayName,
        resumeUrl,
        extractedText,
        parsedPayloadJson: JSON.stringify(payload),
        parseModel: parseModelLabel,
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
