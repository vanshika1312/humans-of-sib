export type ResumeTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function normalizeFilename(fileName: string): string {
  return fileName.toLowerCase().trim();
}

function logResumeExtractError(fileName: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[hiring-resume-text] extract failed", { fileName, message, err });
}

/**
 * Extract plain text from PDF or DOCX buffers (Node/server only).
 *
 * unpdf / mammoth are loaded lazily so routes that only import this module
 * (e.g. Hiring overview via shared server actions) do not pull PDF parsers
 * into every serverless function graph.
 *
 * PDFs use `unpdf` (serverless PDF.js build) — `pdf-parse` v2 needs canvas/worker
 * setup that reliably fails on Next.js/Vercel and surfaces as a generic read error.
 */
export async function extractResumeTextFromBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<ResumeTextResult> {
  const lower = normalizeFilename(fileName);
  try {
    if (lower.endsWith(".pdf")) {
      // PDF.js (via unpdf) may call Math.sumPrecise; polyfill on older Node runtimes.
      const mathWithSum = Math as Math & { sumPrecise?: (values: Iterable<number>) => number };
      if (typeof mathWithSum.sumPrecise !== "function") {
        mathWithSum.sumPrecise = (values) => {
          let total = 0;
          for (const value of values) total += value;
          return total;
        };
      }

      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      const merged = (typeof text === "string" ? text : text.join("\n")).trim();
      if (!merged.length) {
        return {
          ok: false,
          error: "No selectable text in PDF (it may be scanned). Paste details manually.",
        };
      }
      return { ok: true, text: merged };
    }

    if (lower.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.default.extractRawText({ buffer });
      const text = (value || "").trim();
      if (!text.length) {
        return { ok: false, error: "Could not read text from Word file." };
      }
      return { ok: true, text };
    }

    if (lower.endsWith(".doc")) {
      return {
        ok: false,
        error: "Legacy .doc files are not supported — convert to PDF or DOCX and upload again.",
      };
    }

    return { ok: false, error: "Unsupported résumé format." };
  } catch (err) {
    logResumeExtractError(fileName, err);
    return { ok: false, error: "Could not read résumé file." };
  }
}
