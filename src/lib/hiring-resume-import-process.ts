import { prisma } from "@/lib/prisma";
import { persistHiringResumeBuffer } from "@/lib/hiring-resume-upload";
import type { ParsedResumeFields } from "@/lib/hiring-resume-llm";

export type StoredResumePayload = {
  parsed: ParsedResumeFields;
  warnings?: string[];
};

/** Disk + DB staging (fast). Rows are ready for manual field entry immediately. */
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
 * Persist file and insert a staging row (`PARSED` with empty fields, or `FAILED` for bad type/size).
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

  const parsedAt = new Date();
  await prisma.hiringResumeImportItem.create({
    data: {
      batchId: opts.batchId,
      fileName: displayName,
      resumeUrl: uploaded,
      status: "PARSED",
      error: null,
      parsedPayloadJson: STUB_PAYLOAD,
      extractedText: null,
      parseModel: null,
      parsedAt,
    },
  });

  logTiming("stage_done", {
    batchId: opts.batchId,
    fileName: displayName,
    persistMs,
  });
}
