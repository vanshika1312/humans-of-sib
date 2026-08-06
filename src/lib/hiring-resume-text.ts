export type ResumeTextResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function normalizeFilename(fileName: string): string {
  return fileName.toLowerCase().trim();
}

/**
 * Extract plain text from PDF or DOCX buffers (Node/server only).
 *
 * pdf-parse / mammoth are loaded lazily so routes that only import this module
 * (e.g. Hiring overview via shared server actions) do not pull native PDF parsers
 * into every serverless function graph.
 */
export async function extractResumeTextFromBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<ResumeTextResult> {
  const lower = normalizeFilename(fileName);
  try {
    if (lower.endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      const text = (result.text || "").trim();
      if (!text.length) {
        return {
          ok: false,
          error: "No selectable text in PDF (it may be scanned). Paste details manually.",
        };
      }
      return { ok: true, text };
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
  } catch {
    return { ok: false, error: "Could not read résumé file." };
  }
}
