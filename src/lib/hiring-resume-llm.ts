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
    phone: trimOrNull(raw.phone, 64),
    candidateLocation: trimOrNull(raw.candidateLocation, 200),
    fieldConfidence: raw.fieldConfidence,
  };
}

export type LlmParseOutcome =
  | { ok: true; parsed: ParsedResumeFields; model: string }
  | { ok: false; error: string; parsed?: ParsedResumeFields };

function normalizeEnvSecret(raw: string | undefined): string {
  let s = (raw ?? "").trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

async function parsingErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
      message?: string;
    };
    const msg = body.error?.message ?? body.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch {
    /* ignore */
  }
  return "";
}

export type ResolvedLlmResumeParse = {
  apiKey: string;
  baseNormalized: string;
  model: string;
  isOpenRouter: boolean;
};

/**
 * Resolves OpenAI-compatible chat parsing: prefers dedicated OpenRouter env vars, then
 * `HIRING_RESUME_PARSE_*` (OpenAI, OpenRouter, LiteLLM, etc.).
 */
export function resolveLlmParseConfig(): ResolvedLlmResumeParse | null {
  const orKey =
    normalizeEnvSecret(process.env.OPENROUTER_API_KEY) ||
    normalizeEnvSecret(process.env.HIRING_RESUME_OPENROUTER_API_KEY);
  if (orKey) {
    const baseRaw =
      normalizeEnvSecret(process.env.OPENROUTER_BASE_URL) ||
      normalizeEnvSecret(process.env.HIRING_RESUME_OPENROUTER_BASE_URL) ||
      "https://openrouter.ai/api/v1";
    const model =
      normalizeEnvSecret(process.env.OPENROUTER_MODEL) ||
      normalizeEnvSecret(process.env.HIRING_RESUME_OPENROUTER_MODEL) ||
      "openai/gpt-4o-mini";
    return {
      apiKey: orKey,
      baseNormalized: baseRaw.replace(/\/$/, ""),
      model,
      isOpenRouter: true,
    };
  }

  const genericKey = normalizeEnvSecret(process.env.HIRING_RESUME_PARSE_API_KEY);
  if (!genericKey) return null;
  const explicitBase = normalizeEnvSecret(process.env.HIRING_RESUME_PARSE_BASE_URL);
  const baseRaw =
    explicitBase ||
    (genericKey.startsWith("sk-or-") ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1");
  const model =
    normalizeEnvSecret(process.env.HIRING_RESUME_PARSE_MODEL) ||
    (genericKey.startsWith("sk-or-") ? "openai/gpt-4o-mini" : "gpt-4o-mini");
  const baseNormalized = baseRaw.replace(/\/$/, "");
  return {
    apiKey: genericKey,
    baseNormalized,
    model,
    isOpenRouter: baseNormalized.includes("openrouter.ai"),
  };
}

/** True when bulk import can call an LLM (OpenRouter, OpenAI, or other OpenAI-compatible API). */
export function isLlmResumeParsingConfigured(): boolean {
  return resolveLlmParseConfig() !== null;
}

/**
 * Structured extraction via OpenAI-compatible Chat Completions JSON mode.
 */
export async function parseResumeFieldsWithLlm(resumeText: string): Promise<LlmParseOutcome> {
  const cfg = resolveLlmParseConfig();

  const stubParsed: ParsedResumeFields = {
    fullName: null,
    email: null,
    phone: null,
    candidateLocation: null,
    fieldConfidence: {},
  };

  if (!cfg) {
    return {
      ok: false,
      error:
        "Résumé parsing is not configured. Set OPENROUTER_API_KEY (or HIRING_RESUME_PARSE_API_KEY + base URL). Fill fields manually.",
      parsed: stubParsed,
    };
  }

  const { apiKey, baseNormalized, model, isOpenRouter } = cfg;

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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (isOpenRouter) {
    const referer =
      normalizeEnvSecret(process.env.OPENROUTER_HTTP_REFERER) ||
      normalizeEnvSecret(process.env.NEXT_PUBLIC_APP_URL);
    if (referer) headers["HTTP-Referer"] = referer;
    headers["X-Title"] =
      normalizeEnvSecret(process.env.OPENROUTER_APP_TITLE) || "Humans of SIB — résumé import";
  }

  let response: Response;
  try {
    response = await fetch(`${baseNormalized}/chat/completions`, {
      method: "POST",
      headers,
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
    const upstream = await parsingErrorMessage(response);
    const suffix = upstream ? ` ${upstream}` : "";
    const hint401 =
      response.status === 401
        ? " Wrong or mismatched API key for this base URL. For OpenRouter use OPENROUTER_API_KEY and optional OPENROUTER_BASE_URL, or HIRING_RESUME_PARSE_BASE_URL=https://openrouter.ai/api/v1 with an OpenRouter key."
        : "";
    return {
      ok: false,
      error: `Résumé parsing failed (HTTP ${response.status}).${suffix}${hint401} Fill fields manually.`,
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

/** Shared trim rules for ParsedResumeFields (used by Affinda mapper). */
export function sanitizeParsedResumeFields(raw: ParsedResumeFields): ParsedResumeFields {
  return sanitizeParsed(raw);
}
