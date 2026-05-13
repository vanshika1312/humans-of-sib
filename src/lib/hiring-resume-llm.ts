import { z } from "zod";

const fieldConfidenceSchema = z
  .object({
    fullName: z.number().min(0).max(1).optional(),
    email: z.number().min(0).max(1).optional(),
    phone: z.number().min(0).max(1).optional(),
    candidateLocation: z.number().min(0).max(1).optional(),
  })
  .optional();

export const parsedResumeFieldsSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  candidateLocation: z.string().nullable(),
  fieldConfidence: fieldConfidenceSchema,
});

export type ParsedResumeFields = z.infer<typeof parsedResumeFieldsSchema>;

function truncateForModel(text: string, maxChars: number): string {
  const t = text.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[…truncated…]`;
}

function sanitizeParsed(raw: ParsedResumeFields): ParsedResumeFields {
  const trimOrNull = (s: string | null, max: number) => {
    if (s === null || s === undefined) return null;
    const v = String(s).trim();
    if (!v) return null;
    return v.slice(0, max);
  };
  const email = trimOrNull(raw.email, 320)?.toLowerCase() ?? null;
  return {
    fullName: trimOrNull(raw.fullName, 200),
    email,
    phone: trimOrNull(raw.phone, 48),
    candidateLocation: trimOrNull(raw.candidateLocation, 200),
    fieldConfidence: raw.fieldConfidence,
  };
}

export type LlmParseOutcome =
  | { ok: true; parsed: ParsedResumeFields; model: string }
  | { ok: false; error: string; parsed?: ParsedResumeFields };

/**
 * Structured extraction via OpenAI-compatible Chat Completions JSON mode.
 */
export async function parseResumeFieldsWithLlm(resumeText: string): Promise<LlmParseOutcome> {
  const apiKey = process.env.HIRING_RESUME_PARSE_API_KEY?.trim();
  const baseUrl = (
    process.env.HIRING_RESUME_PARSE_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.HIRING_RESUME_PARSE_MODEL?.trim() || "gpt-4o-mini";

  const stubParsed: ParsedResumeFields = {
    fullName: null,
    email: null,
    phone: null,
    candidateLocation: null,
    fieldConfidence: {},
  };

  if (!apiKey) {
    return {
      ok: false,
      error:
        "Résumé parsing is not configured (set HIRING_RESUME_PARSE_API_KEY). Fill fields manually.",
      parsed: stubParsed,
    };
  }

  const bodyText = truncateForModel(resumeText, 14_000);

  const system = `You extract candidate profile fields from résumé plain text for an ATS.
Return ONLY valid JSON matching this shape:
{"fullName": string|null,"email":string|null,"phone":string|null,"candidateLocation":string|null,"fieldConfidence":{"fullName"?:number,"email"?:number,"phone"?:number,"candidateLocation"?:number}}

Rules:
- fullName: candidate's full name as written on the résumé (not company names).
- email: best primary email if clearly present.
- phone: one primary phone with country code if visible.
- candidateLocation: city/region where they appear to be based if stated (not employer HQ).
- fieldConfidence: optional 0–1 confidence per field you populated (omit keys you leave null).
- Use null when unknown — never invent emails or phones.`;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `Résumé text:\n---\n${bodyText}\n---`,
          },
        ],
      }),
    });
  } catch {
    return { ok: false, error: "Could not reach résumé parsing service.", parsed: stubParsed };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `Résumé parsing failed (${response.status}). Fill fields manually.`,
      parsed: stubParsed,
    };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: "Invalid response from parsing service.", parsed: stubParsed };
  }

  const content =
    typeof json === "object" &&
    json !== null &&
    "choices" in json &&
    Array.isArray((json as { choices: unknown }).choices)
      ? (json as { choices: { message?: { content?: string } }[] }).choices[0]?.message?.content
      : null;

  if (!content || typeof content !== "string") {
    return { ok: false, error: "Empty parser response.", parsed: stubParsed };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    return { ok: false, error: "Parser returned non-JSON.", parsed: stubParsed };
  }

  const parsed = parsedResumeFieldsSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return { ok: false, error: "Parser returned unexpected JSON.", parsed: stubParsed };
  }

  return { ok: true, parsed: sanitizeParsed(parsed.data), model };
}
