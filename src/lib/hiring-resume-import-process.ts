import { prisma } from "@/lib/prisma";
import { persistHiringResumeBuffer } from "@/lib/hiring-resume-upload";
import { extractResumeTextFromBuffer } from "@/lib/hiring-resume-text";
import { resolveResumeFields } from "@/lib/hiring-resume-fields";
import type { ParsedResumeFields } from "@/lib/hiring-resume-llm";

export type StoredResumePayload = {
  parsed: ParsedResumeFields;
  warnings?: string[];
};

/** Disk + DB staging. Parse runs after persist so rows arrive with autofilled fields. */
export const RESUME_IMPORT_STAGING_CONCURRENCY = 8;

const EMPTY_PARSED: ParsedResumeFields = {
  fullName: null,
  email: null,
  phone: null,
  candidateLocation: null,
  fieldConfidence: {},
};

const STUB_PAYLOAD = JSON.stringify({ parsed: EMPTY_PARSED } satisfies StoredResumePayload);

function resumeImportTimingsEnabled(): boolean {
  if (process.env.HIRING_RESUME_IMPORT_TIMINGS === "1") return true;
  if (process.env.HIRING_RESUME_IMPORT_TIMINGS === "0") return false;
  return process.env.NODE_ENV === "development";
}

function logTiming(label: string, meta: Record<string, unknown>) {
  if (!resumeImportTimingsEnabled()) return;
  console.warn(`[hire-resume-import] ${label}`, meta);
}

/** Process items in waves of at most `limit` concurrent promises. */
export async function mapWithConcurrencyLimit<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const l = Math.max(1, Math.min(limit, 32));
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(l, items.length) }, () => worker()));
}

/**
 * Heal legacy rows from when parsing ran in the background (`PENDING_PARSE`).
 * Safe to call on every batch load.
 */
export async function resumeImportMarkPendingAsManualReady(batchId: string): Promise<void> {
  const now = new Date();
  await prisma.hiringResumeImportItem.updateMany({
    where: { batchId, status: "PENDING_PARSE" },
    data: {
      status: "PARSED",
      parsedPayloadJson: STUB_PAYLOAD,
      extractedText: null,
      parseModel: null,
      parsedAt: now,
      error: null,
    },
  });
}

/**
 * Persist file, extract text, resolve profile fields, and insert a staging row
 * (`PARSED` with autofilled fields, or `FAILED` for bad type/size).
 */
export async function stageResumeImportItemFromBuffer(opts: {
  batchId: string;
  buffer: Buffer;
  originalFileName: string;
  mimeHint?: string;
}): Promise<void> {
  const displayName = opts.originalFileName.slice(0, 280);
  const persistT0 = performance.now();
  const uploaded = await persistHiringResumeBuffer(
    opts.buffer,
    opts.originalFileName,
    opts.mimeHint,
  );
  const persistMs = Math.round(performance.now() - persistT0);

  if (uploaded === "TOO_LARGE" || uploaded === "UNSUPPORTED_TYPE") {
    const parsedAtFail = new Date();
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
        parsedPayloadJson: STUB_PAYLOAD,
        parsedAt: parsedAtFail,
      },
    });
    logTiming("stage_fail", {
      batchId: opts.batchId,
      fileName: displayName,
      reason: uploaded,
      persistMs,
    });
    return;
  }

  const parseT0 = performance.now();
  const extracted = await extractResumeTextFromBuffer(opts.buffer, opts.originalFileName);
  let extractedText: string | null = null;
  let parsedPayloadJson = STUB_PAYLOAD;
  let parseModel: string | null = null;
  let warnings: string[] = [];

  if (extracted.ok) {
    extractedText = extracted.text;
    const resolved = await resolveResumeFields(extracted.text);
    parsedPayloadJson = JSON.stringify({
      parsed: resolved.parsed,
      warnings: resolved.warnings,
    } satisfies StoredResumePayload);
    parseModel = resolved.model;
    warnings = resolved.warnings;
  } else {
    warnings = [extracted.error];
    parsedPayloadJson = JSON.stringify({
      parsed: EMPTY_PARSED,
      warnings,
    } satisfies StoredResumePayload);
  }

  const parseMs = Math.round(performance.now() - parseT0);
  const parsedAt = new Date();
  await prisma.hiringResumeImportItem.create({
    data: {
      batchId: opts.batchId,
      fileName: displayName,
      resumeUrl: uploaded,
      status: "PARSED",
      error: extracted.ok ? null : extracted.error.slice(0, 500),
      parsedPayloadJson,
      extractedText,
      parseModel,
      parsedAt,
    },
  });

  logTiming("stage_done", {
    batchId: opts.batchId,
    fileName: displayName,
    persistMs,
    parseMs,
    extractedChars: extractedText?.length ?? 0,
    fieldSource: parseModel ? "llm" : "rule_based",
  });
}
